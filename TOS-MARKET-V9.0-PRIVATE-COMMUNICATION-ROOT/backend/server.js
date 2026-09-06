const express=require('express');const cookieParser=require('cookie-parser');const path=require('path');const dotenv=require('dotenv');const http=require('http');const jwt=require('jsonwebtoken');const {WebSocketServer}=require('ws');dotenv.config();const db=require('./db');
const app=express();
const BUILD_VERSION='9.0.0-private-chat-calls';app.set('trust proxy',1);app.use(express.json({limit:'3mb'}));app.use(express.urlencoded({extended:true}));app.use(cookieParser());
app.use('/assets',express.static(path.join(__dirname,'..','assets')));app.use(express.static(path.join(__dirname,'..')));
app.use('/api/products',require('./routes/products'));app.use('/api/orders',require('./routes/orders'));app.use('/api/crypto',require('./routes/crypto').router);app.use('/api/payments',require('./routes/payments'));app.use('/api/messages',require('./routes/messages'));app.use('/api/admin',require('./routes/admin'));app.use('/api/users',require('./routes/users'));app.use('/api/reviews',require('./routes/reviews'));app.use('/api/settings',require('./routes/settings'));app.use('/api/assistant',require('./routes/assistant'));
const ADMIN_PATH=String(process.env.ADMIN_PATH||'control-room-7x91').replace(/^\/+|\/+$/g,'');app.get('/'+ADMIN_PATH,(req,res)=>res.sendFile(path.join(__dirname,'private-admin.html')));app.get('/admin',(req,res)=>res.status(404).send('Not found'));app.get('/'+ADMIN_PATH+'/',(req,res)=>res.sendFile(path.join(__dirname,'private-admin.html')));
app.get('/health',(req,res)=>res.json({ok:true,service:'tos-market',build:BUILD_VERSION,payment:'TRX/TRON'}));
app.get('/api/version',(req,res)=>res.json({build:BUILD_VERSION,payment:'TRX/TRON',wallet:process.env.TRX_PAYMENT_ADDRESS||''}));
const port=Number(process.env.PORT||3000);

// WebRTC signaling server. Media stays peer-to-peer; this server only relays SDP/ICE messages.
function cookieValue(header,name){const m=String(header||'').match(new RegExp('(?:^|;\\s*)'+name.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}
async function wsUser(req){try{const token=cookieValue(req.headers.cookie,'tos_user');if(!token||!process.env.JWT_SECRET)return null;const p=jwt.verify(token,process.env.JWT_SECRET);const r=await db.query("SELECT u.id,u.nickname,u.display_name,u.account_status,COALESCE(up.profile_public,TRUE) profile_public FROM users u LEFT JOIN user_preferences up ON up.user_id=u.id WHERE u.id=$1",[p.id]);const u=r.rows[0];return u&&u.account_status==='active'&&u.profile_public?u:null;}catch{return null;}}
const server=http.createServer(app);
const wss=new WebSocketServer({server,path:'/ws/call'});
const peers=new Map();
function sendWS(ws,payload){if(ws&&ws.readyState===1)ws.send(JSON.stringify(payload));}
wss.on('connection',async(ws,req)=>{
  const user=await wsUser(req);if(!user){ws.close(1008,'Giriş gerekli');return;}
  ws.user=user;let roomKey=null;
  ws.on('message',async raw=>{
    let msg;try{msg=JSON.parse(raw.toString())}catch{return}
    if(msg.type==='join'){
      const targetId=Number(msg.targetId);if(!Number.isInteger(targetId)||targetId===user.id){sendWS(ws,{type:'error',message:'Geçersiz görüşme hedefi.'});return;}
      const r=await db.query("SELECT u.id,u.nickname,u.display_name,COALESCE(up.profile_public,TRUE) profile_public FROM users u LEFT JOIN user_preferences up ON up.user_id=u.id WHERE u.id=$1 AND u.account_status='active'",[targetId]);
      if(!r.rows[0]||!r.rows[0].profile_public){sendWS(ws,{type:'error',message:'Bu profil görüşmeye kapalı.'});return;}
      roomKey=[user.id,targetId].sort((a,b)=>a-b).join(':');
      ws.roomKey=roomKey; if(!peers.has(roomKey))peers.set(roomKey,new Set());
      const room=peers.get(roomKey);room.add(ws);sendWS(ws,{type:'joined',initiator:room.size===1,peerCount:room.size});
      for(const other of room)if(other!==ws)sendWS(other,{type:'peer-joined',user:{id:user.id,nickname:user.nickname,display_name:user.display_name}});
    } else if(msg.type==='signal'&&roomKey){for(const other of peers.get(roomKey)||[])if(other!==ws)sendWS(other,{type:'signal',from:user.id,data:msg.data});}
  });
  ws.on('close',()=>{if(roomKey&&peers.has(roomKey)){const room=peers.get(roomKey);room.delete(ws);for(const other of room)sendWS(other,{type:'peer-left',userId:user.id});if(!room.size)peers.delete(roomKey)}});
});
(async()=>{try{await db.initDb();server.listen(port,'0.0.0.0',()=>console.log(`TOS MARKET running on ${port}`));}catch(err){console.error('Database initialization failed:',err);process.exit(1);}})();
