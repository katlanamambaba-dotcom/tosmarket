const router=require('express').Router();
const db=require('../db');
const {userAuth}=require('../middleware/user');
const crypto=require('crypto');
const rooms=new Map();
function roomInfo(r){return {id:r.id,name:r.name,owner_id:r.owner_id,owner_nickname:r.owner_nickname,count:r.members.size,max:5,created_at:r.created_at};}
function isPublic(id){return db.query('SELECT u.id FROM users u LEFT JOIN user_preferences p ON p.user_id=u.id WHERE u.id=$1 AND u.account_status=\'active\' AND COALESCE(p.profile_public,TRUE)=TRUE',[id]);}
router.get('/rooms',userAuth,async(req,res)=>{res.json({rooms:[...rooms.values()].filter(r=>r.members.size>0).map(roomInfo)});});
router.post('/rooms',userAuth,async(req,res)=>{try{const pub=await isPublic(req.user.id);if(!pub.rows[0])return res.status(403).json({error:'Görüşme odasına katılmak için profilin açık olmalı.'});const id=crypto.randomBytes(4).toString('hex').toUpperCase();const room={id,name:String(req.body?.name||`${req.user.nickname} odası`).trim().slice(0,60)||'TOS Görüşme Odası',owner_id:req.user.id,owner_nickname:req.user.nickname,members:new Map(),created_at:new Date().toISOString()};rooms.set(id,room);res.status(201).json({room:roomInfo(room)});}catch(e){res.status(500).json({error:'Oda oluşturulamadı.'});}});
router.delete('/rooms/:id',userAuth,(req,res)=>{const r=rooms.get(String(req.params.id).toUpperCase());if(!r)return res.status(404).json({error:'Oda bulunamadı.'});if(r.owner_id!==req.user.id)return res.status(403).json({error:'Sadece oda sahibi kapatabilir.'});rooms.delete(r.id);res.json({ok:true});});
module.exports={router,rooms,isPublic,roomInfo};
