const router=require('express').Router();const db=require('../db');const {userAuth}=require('../middleware/user');
router.get('/',userAuth,async(req,res)=>{const {rows}=await db.query('SELECT id,type,title,body,link,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id]);res.json({notifications:rows,unread:rows.filter(x=>!x.is_read).length});});
router.patch('/:id/read',userAuth,async(req,res)=>{await db.query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);res.json({ok:true});});
router.post('/read-all',userAuth,async(req,res)=>{await db.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1',[req.user.id]);res.json({ok:true});});
module.exports=router;