const router=require('express').Router();
const db=require('../db');
const crypto=require('crypto');
const TRON_API=process.env.TRON_API_URL||'https://api.trongrid.io';
const PAYMENT_ADDRESS=process.env.TRX_PAYMENT_ADDRESS||process.env.USDT_TRC20_ADDRESS||'';
const EXPIRY_MINUTES=Math.max(10,Number(process.env.CRYPTO_PAYMENT_EXPIRY_MINUTES||30));
const FALLBACK_TRX_USD=Number(process.env.TRX_USD_RATE||0.332);
let cachedRate={value:FALLBACK_TRX_USD,at:0};
function headers(){const h={'Accept':'application/json'};if(process.env.TRONGRID_API_KEY)h['TRON-PRO-API-KEY']=process.env.TRONGRID_API_KEY;return h;}
async function tron(path){const r=await fetch(TRON_API+path,{headers:headers()});if(!r.ok)throw new Error(`TRON API ${r.status}`);return r.json();}
async function getSettings(){const {rows}=await db.query("SELECT key,value FROM site_settings WHERE key IN ('usd_try_rate','trx_usd_rate','payment_address','payment_expiry_minutes')");return Object.fromEntries(rows.map(x=>[x.key,x.value]));}
async function getTrxUsd(){if(Date.now()-cachedRate.at<60_000&&cachedRate.value>0)return cachedRate.value;try{const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd');const d=await r.json();const v=Number(d?.tron?.usd);if(v>0){cachedRate={value:v,at:Date.now()};return v;}}catch{}return cachedRate.value||FALLBACK_TRX_USD;}
function toSun(value){return BigInt(Math.round(Number(value)*1_000_000));}
function formatTrx(sun){const s=sun.toString().padStart(7,'0');return `${s.slice(0,-6)}.${s.slice(-6)}`;}
async function makeAmount(totalTry){const s=await getSettings();const usdTry=Number(s.usd_try_rate||50);if(!usdTry||usdTry<=0)throw new Error('USD/TRY kuru yapılandırılmadı.');const trxUsd=await getTrxUsd();if(!trxUsd||trxUsd<=0)throw new Error('TRX kuru alınamadı.');const usd=Number(totalTry)/usdTry;const base=toSun(usd/trxUsd);const extra=BigInt(1+Math.floor(Math.random()*99999));return {sun:base+extra,trxUsd,usdTry,usd};}
function extractTransfers(rows){const out=[];for(const tx of rows){const contracts=tx.raw_data?.contract||[];for(const c of contracts){if(c.type!=='TransferContract')continue;const v=c.parameter?.value||{};out.push({to:v.to_address,amountSun:BigInt(String(v.amount||0)),hash:tx.txID||tx.tx_id||tx.id,confirmed:tx.ret?.[0]?.contractRet==='SUCCESS'||tx.ret?.[0]?.contractRet===undefined,blockTimestamp:tx.raw_data?.timestamp||tx.block_timestamp||0});}}return out;}
async function checkPayment(payment){
  const min=Date.parse(payment.created_at)-60_000;
  const q=`/v1/accounts/${encodeURIComponent(payment.payment_address)}/transactions?limit=200&only_confirmed=true&only_to=true&visible=true&min_timestamp=${min}&order_by=block_timestamp,desc`;
  const data=await tron(q);const rows=Array.isArray(data.data)?data.data:[];const transfers=extractTransfers(rows);
  for(const tx of transfers){if(String(tx.to||'').toLowerCase()!==String(payment.payment_address).toLowerCase())continue;if(tx.amountSun!==toSun(payment.expected_amount))continue;if(!tx.hash)continue;const used=await db.query('SELECT id FROM crypto_payments WHERE tx_hash=$1',[tx.hash]);if(used.rows.length)continue;if(!tx.confirmed)continue;return {hash:tx.hash,received_amount:formatTrx(tx.amountSun)};}
  return null;
}
router.get('/rates',async(req,res)=>{try{const s=await getSettings();const usdTry=Number(s.usd_try_rate||50);const trxUsd=await getTrxUsd();res.json({usdTry,trxUsd,paymentAddress:s.payment_address||PAYMENT_ADDRESS});}catch(e){res.status(500).json({error:'Kurlar alınamadı.'})}});
router.post('/create',async(req,res)=>{try{
  const {orderId,token}=req.body||{};if(!orderId||!token)return res.status(400).json({error:'Sipariş anahtarı eksik.'});
  const {rows}=await db.query('SELECT * FROM orders WHERE id=$1 AND payment_token=$2',[orderId,token]);const order=rows[0];if(!order)return res.status(404).json({error:'Sipariş bulunamadı.'});
  if(order.payment_method!=='crypto_trx')return res.status(400).json({error:'Bu sipariş TRX ödemesi değil.'});
  const s=await getSettings();const address=s.payment_address||PAYMENT_ADDRESS;if(!address)return res.status(503).json({error:'TRX ödeme adresi yapılandırılmamış.'});
  const existing=await db.query('SELECT * FROM crypto_payments WHERE order_id=$1',[order.id]);if(existing.rows[0])return res.json({payment:existing.rows[0],address,network:'TRON',token:'TRX'});
  const calc=await makeAmount(order.total);const amount=formatTrx(calc.sun);const expires=new Date(Date.now()+Number(s.payment_expiry_minutes||EXPIRY_MINUTES)*60_000);
  const r=await db.query(`INSERT INTO crypto_payments(order_id,payment_token,network,token,expected_amount,payment_address,status,expires_at,rate_snapshot) VALUES($1,$2,'TRON','TRX',$3,$4,'waiting',$5,$6) RETURNING *`,[order.id,token,amount,address,expires,JSON.stringify({usd_try:calc.usdTry,trx_usd:calc.trxUsd,usd:calc.usd})]);
  res.status(201).json({payment:r.rows[0],address,network:'TRON',token:'TRX',rates:{usdTry:calc.usdTry,trxUsd:calc.trxUsd,usd:calc.usd}});
}catch(e){console.error('crypto create',e);res.status(400).json({error:e.message||'TRX ödeme oluşturulamadı.'});}});
router.get('/status/:orderId',async(req,res)=>{try{
  const token=String(req.query.token||'');const {rows}=await db.query('SELECT cp.*,o.status AS order_status FROM crypto_payments cp JOIN orders o ON o.id=cp.order_id WHERE cp.order_id=$1 AND cp.payment_token=$2',[req.params.orderId,token]);const payment=rows[0];if(!payment)return res.status(404).json({error:'Ödeme bulunamadı.'});
  if(payment.status==='waiting'&&new Date(payment.expires_at)>new Date()){const found=await checkPayment(payment);if(found){await db.query('BEGIN');try{const lock=await db.query('SELECT status FROM crypto_payments WHERE id=$1 FOR UPDATE',[payment.id]);if(lock.rows[0]?.status==='waiting'){await db.query("UPDATE crypto_payments SET status='confirmed',tx_hash=$1,received_amount=$2,confirmed_at=NOW() WHERE id=$3",[found.hash,found.received_amount,payment.id]);await db.query("UPDATE orders SET status='paid' WHERE id=$1",[payment.order_id]);}await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}payment.status='confirmed';payment.tx_hash=found.hash;payment.received_amount=found.received_amount;payment.order_status='paid';}}
  if(payment.status==='waiting'&&new Date(payment.expires_at)<=new Date()){await db.query("UPDATE crypto_payments SET status='expired' WHERE id=$1 AND status='waiting'",[payment.id]);await db.query("UPDATE orders SET status='cancelled' WHERE id=$1 AND status='pending'",[payment.order_id]);await db.query("UPDATE products p SET stock=p.stock+oi.quantity,updated_at=NOW() FROM order_items oi WHERE oi.order_id=$1 AND oi.product_id=p.id",[payment.order_id]);payment.status='expired';payment.order_status='cancelled';}
  res.json({payment});
}catch(e){console.error('Crypto status:',e);res.status(500).json({error:'TRX ödeme kontrolü geçici olarak kullanılamıyor.'});}});
module.exports={router,checkPayment};
