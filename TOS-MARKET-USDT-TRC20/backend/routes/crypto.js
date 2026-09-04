const router=require('express').Router();
const db=require('../db');

const TRON_API=process.env.TRON_API_URL||'https://api.trongrid.io';
const USDT_CONTRACT=(process.env.USDT_TRC20_CONTRACT||'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').toLowerCase();
const PAYMENT_ADDRESS=process.env.USDT_TRC20_ADDRESS||'';
const RATE=Number(process.env.USDT_TRY_RATE||0);
const EXPIRY_MINUTES=Math.max(10,Number(process.env.CRYPTO_PAYMENT_EXPIRY_MINUTES||30));

function headers(){const h={'Accept':'application/json'};if(process.env.TRONGRID_API_KEY)h['TRON-PRO-API-KEY']=process.env.TRONGRID_API_KEY;return h;}
function toMicro(value){return BigInt(Math.round(Number(value)*1_000_000));}
function formatUsdt(micro){const s=micro.toString().padStart(7,'0');return `${s.slice(0,-6)}.${s.slice(-6)}`;}
function makeAmount(tl){if(!RATE||RATE<=0)throw new Error('USDT_TRY_RATE Render ortam değişkeni ayarlanmalı.');const base=Number(tl)/RATE;const micro=toMicro(base);const extra=BigInt(1+Math.floor(Math.random()*999));return micro+extra;}

async function tron(path){const r=await fetch(TRON_API+path,{headers:headers()});if(!r.ok)throw new Error(`TRON API ${r.status}`);return r.json();}
async function tronPost(path,body){const r=await fetch(TRON_API+path,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`TRON API ${r.status}`);return r.json();}
async function checkPayment(payment){
  const min=Date.parse(payment.created_at)-60_000;
  const q=`/v1/accounts/${encodeURIComponent(PAYMENT_ADDRESS)}/transactions/trc20?limit=100&only_to=true&contract_address=${USDT_CONTRACT}&min_timestamp=${min}`;
  const data=await tron(q);
  const rows=Array.isArray(data.data)?data.data:[];
  for(const tx of rows){
    if(String(tx.to||'').toLowerCase()!==PAYMENT_ADDRESS.toLowerCase())continue;
    if(String(tx.token_info?.address||'').toLowerCase()!==USDT_CONTRACT)continue;
    const amount=BigInt(String(tx.value||'0'));
    if(amount<toMicro(payment.expected_amount))continue;
    const hash=tx.transaction_id;
    if(!hash)continue;
    const solid=await tronPost('/walletsolidity/gettransactionbyid',{value:hash}).catch(()=>null);
    if(!solid||!solid.txID)continue;
    if(Array.isArray(solid.ret)&&solid.ret[0]&&solid.ret[0].contractRet&&solid.ret[0].contractRet!=='SUCCESS')continue;
    return {hash,received_amount:formatUsdt(amount)};
  }
  return null;
}

router.post('/create',async(req,res)=>{
  try{
    if(!PAYMENT_ADDRESS)return res.status(503).json({error:'USDT TRC20 ödeme adresi yapılandırılmamış.'});
    const {orderId,token}=req.body||{};
    if(!orderId||!token)return res.status(400).json({error:'orderId ve payment token gerekli.'});
    const {rows}=await db.query('SELECT * FROM orders WHERE id=$1 AND payment_token=$2',[orderId,token]);
    const order=rows[0];if(!order)return res.status(404).json({error:'Sipariş bulunamadı.'});
    if(order.payment_method!=='crypto_trc20')return res.status(400).json({error:'Bu sipariş kripto ödemesi değil.'});
    const existing=await db.query('SELECT * FROM crypto_payments WHERE order_id=$1',[order.id]);
    if(existing.rows[0])return res.json({payment:existing.rows[0],address:PAYMENT_ADDRESS,network:'TRC20',token:'USDT'});
    const micro=makeAmount(order.total);const amount=formatUsdt(micro);
    const expires=new Date(Date.now()+EXPIRY_MINUTES*60_000);
    const r=await db.query(`INSERT INTO crypto_payments(order_id,payment_token,network,token,expected_amount,payment_address,status,expires_at) VALUES($1,$2,'TRC20','USDT',$3,$4,'waiting',$5) RETURNING *`,[order.id,token,amount,PAYMENT_ADDRESS,expires]);
    res.status(201).json({payment:r.rows[0],address:PAYMENT_ADDRESS,network:'TRC20',token:'USDT'});
  }catch(e){res.status(400).json({error:e.message||'Kripto ödeme oluşturulamadı.'});}
});

router.get('/status/:orderId',async(req,res)=>{
  try{
    const token=String(req.query.token||'');
    const {rows}=await db.query('SELECT cp.*,o.status AS order_status FROM crypto_payments cp JOIN orders o ON o.id=cp.order_id WHERE cp.order_id=$1 AND cp.payment_token=$2',[req.params.orderId,token]);
    const payment=rows[0];if(!payment)return res.status(404).json({error:'Ödeme bulunamadı.'});
    if(payment.status==='waiting'&&new Date(payment.expires_at)>new Date()){
      const found=await checkPayment(payment);
      if(found){
        await db.query('BEGIN');
        try{
          const lock=await db.query('SELECT status FROM crypto_payments WHERE id=$1 FOR UPDATE',[payment.id]);
          if(lock.rows[0]?.status==='waiting'){
            await db.query("UPDATE crypto_payments SET status='confirmed',tx_hash=$1,received_amount=$2,confirmed_at=NOW() WHERE id=$3",[found.hash,found.received_amount,payment.id]);
            await db.query("UPDATE orders SET status='paid',payment_method='crypto_trc20' WHERE id=$1",[payment.order_id]);
          }
          await db.query('COMMIT');
        }catch(e){await db.query('ROLLBACK');throw e;}
        payment.status='confirmed';payment.tx_hash=found.hash;payment.received_amount=found.received_amount;payment.order_status='paid';
      }
    }
    if(payment.status==='waiting'&&new Date(payment.expires_at)<=new Date()){
      await db.query('UPDATE crypto_payments SET status=\'expired\' WHERE id=$1 AND status=\'waiting\'',[payment.id]);
      await db.query("UPDATE orders SET status='cancelled' WHERE id=$1 AND status='pending'",[payment.order_id]);
      payment.status='expired';payment.order_status='cancelled';
    }
    res.json({payment});
  }catch(e){console.error('Crypto status:',e);res.status(500).json({error:'Ödeme kontrolü geçici olarak kullanılamıyor.'});}
});

module.exports={router,checkPayment};
