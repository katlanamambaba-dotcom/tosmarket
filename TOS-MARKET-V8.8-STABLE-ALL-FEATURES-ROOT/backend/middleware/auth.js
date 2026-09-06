const jwt=require('jsonwebtoken');
function adminAuth(req,res,next){const token=req.cookies?.tos_admin; if(!token)return res.status(401).json({error:'Admin login required'}); try{req.admin=jwt.verify(token,process.env.JWT_SECRET); if(req.admin.role!=='admin')throw new Error(); next();}catch(e){return res.status(401).json({error:'Admin session expired'});}}
module.exports={adminAuth};
