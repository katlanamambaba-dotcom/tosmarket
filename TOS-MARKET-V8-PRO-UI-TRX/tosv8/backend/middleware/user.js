const jwt=require('jsonwebtoken');
const db=require('../db');
async function userAuth(req,res,next){try{const token=req.cookies.tos_user;if(!token||!process.env.JWT_SECRET)return res.status(401).json({error:'Giriş gerekli.'});const p=jwt.verify(token,process.env.JWT_SECRET);const {rows}=await db.query('SELECT id,nickname,email,display_name,bio,avatar_mime,created_at FROM users WHERE id=$1',[p.id]);if(!rows[0])return res.status(401).json({error:'Kullanıcı bulunamadı.'});req.user=rows[0];next();}catch{return res.status(401).json({error:'Giriş gerekli.'});}}
module.exports={userAuth};
