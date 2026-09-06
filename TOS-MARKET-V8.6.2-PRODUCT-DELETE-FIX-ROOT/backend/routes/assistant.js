const router=require('express').Router();
const db=require('../db');
const jwt=require('jsonwebtoken');

function optionalUser(req){try{const token=req.cookies?.tos_user;if(!token||!process.env.JWT_SECRET)return null;return jwt.verify(token,process.env.JWT_SECRET)}catch{return null}}

async function smartFallback(q){
  const low=String(q||'').toLowerCase().trim();
  if(/^(naber|ne haber|nasılsın|nasilsin|selam|merhaba|hey|hi|hello)(?:\b|$)/.test(low))return 'İyiyim 😄 TOS MARKET tarafında hazırım. Sen nasılsın? İstersen ürün bulabilir, TRX ödeme akışını öğrenebilir, siparişini takip edebilir veya doğrudan canlı desteğe geçebilirsin.';
  const {rows:ps}=await db.query("SELECT name,price,category,stock FROM products WHERE status='active' ORDER BY created_at DESC LIMIT 30");
  if(/fiyat|ücret|kaç|tl|dolar|usd/.test(low))return 'Fiyatlar TL bazında gösterilir. Ürün detaylarında yaklaşık USD karşılığını da görebilirsin.';
  if(/ödeme|trx|transfer|cüzdan|adres|wallet|tron/.test(low))return 'Ödeme TRON ağı üzerinden TRX ile yapılır. Checkout ekranındaki adrese tam beklenen tutarı gönderip ardından ödeme bildirimi oluşturabilirsin. Blockchain doğrulaması sonrası sipariş durumu güncellenir.';
  if(/teslim|ne zaman|gelir|kod/.test(low))return 'Dijital teslimatlar ödeme doğrulandıktan sonra sipariş detayında görünür. Otomatik teslimatı olmayan ürünlerde canlı destek ekibi yardımcı olur.';
  if(/iade|iptal/.test(low))return 'İade veya iptal için sipariş numaranla canlı desteğe yaz. Blockchain transferlerinde işlem hashini paylaşman incelemeyi hızlandırabilir.';
  if(/hesap|kayıt|nickname|profil/.test(low))return 'Nickname + e-posta + güçlü şifre ile hesap oluşturabilirsin. Profil, sipariş, gizlilik ve dil ayarları hesap merkezinde ayrı sayfalarda.';
  if(/ürün|market|ne sat|kategori/.test(low)){const list=ps.slice(0,6).map(p=>`${p.name} (${p.price} TL)`).join(', ');return `Marketplace'te ${list||'aktif dijital ürünler'} bulunuyor. Kategori veya arama alanıyla filtreleyebilirsin.`;}
  return 'Ben TOS MARKET yapay zekâ destek asistanıyım. Ürün, ödeme, TRX, sipariş, teslimat, hesap ve destek konularında yardımcı olabilirim. İstersen doğrudan canlı ekibe de geçebilirsin.';
}

router.get('/status',(req,res)=>res.json({configured:Boolean(process.env.OPENAI_API_KEY),model:process.env.OPENAI_MODEL||'gpt-5.6-luna'}));

router.post('/',async(req,res)=>{
  const message=String(req.body.message||'').trim();
  if(!message)return res.status(400).json({error:'Mesaj boş.'});
  if(process.env.OPENAI_API_KEY){
    try{
      const [{rows:ps},{rows:ss}]=await Promise.all([
        db.query("SELECT name,price,category,stock,description FROM products WHERE status='active' ORDER BY created_at DESC LIMIT 50"),
        db.query("SELECT key,value FROM site_settings WHERE key IN ('usd_try_rate','payment_address','store_name','store_tagline')")
      ]);
      const settings=Object.fromEntries(ss.map(x=>[x.key,x.value]));
      let orderContext='Kullanıcı sipariş özeti: giriş yapılmamış.';
      const u=optionalUser(req);
      if(u?.id){
        const {rows:orders}=await db.query('SELECT id,total,status,payment_method,created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',[u.id]);
        orderContext=`Kullanıcı hesabı: @${u.id}. Son siparişler:\n${orders.map(o=>`#${o.id} | ${o.status} | ${o.total} TL | ${o.payment_method} | ${new Date(o.created_at).toISOString()}`).join('\n')||'Sipariş yok.'}`;
      }
      const catalog=ps.map(p=>`${p.name} | ${p.category} | ${p.price} TL | stok ${p.stock} | ${p.description||''}`).join('\n');
      const context=`Mağaza: ${settings.store_name||'TOS MARKET'}\nSlogan: ${settings.store_tagline||'Dijital marketplace'}\nUSD/TRY: ${settings.usd_try_rate||50}\nÖdeme: TRX / TRON\nÖdeme adresi: ${settings.payment_address||'checkout ekranındaki adres'}\n${orderContext}\nAktif katalog:\n${catalog}`;
      const system=`Sen TOS MARKET'in gerçek müşteri destek yapay zekâsısın. Doğal, kısa ama yararlı konuş. Kullanıcı hangi dilde yazarsa o dilde cevap ver (Türkçe/İngilizce/Almanca). Ürün, fiyat, stok, ödeme, TRX/TRON, sipariş, teslimat, profil ve canlı destek konularında yardımcı ol. Verilen mağaza verisinin dışına çıkıp ürün, fiyat, sipariş durumu veya özellik uydurma. Kullanıcıdan seed phrase, private key, şifre, kart bilgisi veya hassas kimlik bilgisi isteme. Kullanıcı özel sipariş durumunu sorarsa yalnızca verilen gerçek sipariş verisini kullan; yoksa sipariş sayfasına/canlı desteğe yönlendir. Sorun canlı ekibin incelemesini gerektiriyorsa açıkça canlı desteğe geçmesini öner.\n\n${context}`;
      const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:message}]}],max_output_tokens:500})});
      const d=await r.json();
      const answer=d.output_text||d.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n').trim();
      if(r.ok&&answer)return res.json({answer,assistant:'TOS AI'});
      console.error('OpenAI response error:',d?.error?.message||r.status);
    }catch(e){console.error('OpenAI request error:',e.message)}
  }
  res.json({answer:await smartFallback(message),assistant:process.env.OPENAI_API_KEY?'TOS AI (yedek yanıt)':'TOS AI'});
});
module.exports=router;
