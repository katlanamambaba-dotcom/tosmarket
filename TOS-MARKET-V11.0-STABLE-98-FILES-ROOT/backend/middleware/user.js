const jwt=require('jsonwebtoken');
const db=require('../db');
async function loadUser(id){
  const {rows}=await db.query('SELECT id,nickname,email,display_name,bio,avatar_mime,cover_mime,account_status,last_seen_at,moderation_note,created_at,updated_at FROM users WHERE id=$1',[id]);
  return rows[0]||null;
}
function touch(id){
  return db.query("UPDATE users SET last_seen_at=NOW() WHERE id=$1 AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '60 seconds')",[id]).catch(()=>{});
}
async function userAuth(req,res,next){
  try{
    const token=req.cookies.tos_user;
    if(!token||!process.env.JWT_SECRET)return res.status(401).json({error:'Giriş gerekli.'});
    const p=jwt.verify(token,process.env.JWT_SECRET);
    const u=await loadUser(p.id);
    if(!u)return res.status(401).json({error:'Kullanıcı bulunamadı.'});
    if(u.account_status!=='active'){
      const msg=u.account_status==='banned'?'Hesabın kalıcı olarak engellenmiş.':'Hesabın geçici olarak askıya alınmış.';
      return res.status(403).json({error:msg});
    }
    req.user=u; touch(u.id); next();
  }catch{return res.status(401).json({error:'Giriş gerekli.'});}
}
async function optionalUserAuth(req,res,next){
  try{
    const token=req.cookies.tos_user;
    if(token&&process.env.JWT_SECRET){
      const p=jwt.verify(token,process.env.JWT_SECRET);
      const u=await loadUser(p.id);
      if(u&&u.account_status==='active'){req.user=u;touch(u.id);}
    }
  }catch{}
  next();
}
module.exports={userAuth,optionalUserAuth};
