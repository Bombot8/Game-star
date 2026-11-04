// GameStats API — Node.js 18+ (aucune dépendance externe)
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const recent = new Map();
function send(res,status,body,type='application/json; charset=utf-8') {
  res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'});
  res.end(type.startsWith('application/json')?JSON.stringify(body):body);
}
function readJson(req){return new Promise((resolve,reject)=>{let data='';req.on('data',chunk=>{data+=chunk;if(data.length>8000){reject(new Error('Requête trop volumineuse.'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(data||'{}'))}catch{reject(new Error('JSON invalide.'))}});req.on('error',reject)})}
function limited(req){const key=req.socket.remoteAddress||'unknown',now=Date.now(),prev=recent.get(key)||0;if(now-prev<1000)return true;recent.set(key,now);if(recent.size>5000)for(const [k,t] of recent)if(now-t>60000)recent.delete(k);return false}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{ok:true,service:'GameStats API',version:'0.7',integrations:{roblox:true,valorant:!!process.env.RIOT_API_KEY,rocketLeague:'local-telemetry',fortnite:'public-island-metrics'}});
  if(req.method==='GET'&&url.pathname==='/api/valorant/leaderboard'){
    if(limited(req))return send(res,429,{error:'Attends un instant avant une nouvelle recherche.'});
    const key=process.env.RIOT_API_KEY;if(!key)return send(res,503,{error:'Clé Riot absente. Ajoute RIOT_API_KEY côté serveur après avoir obtenu les accès adaptés.'});
    const region=(url.searchParams.get('region')||'eu').toLowerCase();if(!['eu','na','ap','kr','br','latam'].includes(region))return send(res,400,{error:'Région invalide.'});
    try{
      const headers={'X-Riot-Token':key,'Accept':'application/json'};
      const contentRes=await fetch(`https://${region}.api.riotgames.com/val/content/v1/contents?locale=fr-FR`,{headers});
      if(!contentRes.ok)return send(res,contentRes.status===403?503:502,{error:contentRes.status===403?'Accès Riot refusé : vérifie le type et les autorisations de ta clé.':'Impossible de récupérer le contenu compétitif Riot.'});
      const content=await contentRes.json();const acts=(content.acts||[]).concat(...(content.episodes||[]).map(e=>e.acts||[]));const active=acts.find(a=>a.isActive);
      if(!active?.id)return send(res,503,{error:'Acte compétitif actif introuvable dans le catalogue Riot.'});
      const lbRes=await fetch(`https://${region}.api.riotgames.com/val/ranked/v1/leaderboards/by-act/${encodeURIComponent(active.id)}?size=10&startIndex=0`,{headers});
      if(!lbRes.ok)return send(res,lbRes.status===403?503:502,{error:'Le classement Riot est indisponible avec cette clé ou cet acte.'});
      const data=await lbRes.json();return send(res,200,{region,actId:active.id,actName:active.name||'Acte actif',players:(data.players||[]).map((x,i)=>({rank:x.leaderboardRank||i+1,name:x.gameName||'Joueur',tag:x.tagLine||'',rr:x.rankedRating??null,wins:x.numberOfWins??null}))});
    }catch{return send(res,502,{error:'Erreur de connexion aux services Riot.'})}
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/fortnite/island/')){
    if(limited(req))return send(res,429,{error:'Attends un instant avant une nouvelle recherche.'});
    const code=decodeURIComponent(url.pathname.slice('/api/fortnite/island/'.length)).trim();
    if(!/^[A-Za-z0-9_-]{3,40}$/.test(code))return send(res,400,{error:'Code d’île invalide.'});
    try{
      const base='https://api.fortnite.com/ecosystem/v1/islands/'+encodeURIComponent(code);
      const [metaRes,metricsRes]=await Promise.all([
        fetch(base,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(8000)}),
        fetch(base+'/metrics/day',{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(8000)})
      ]);
      if(metaRes.status===404)return send(res,404,{error:'Île Fortnite introuvable ou non publique.'});
      if(!metaRes.ok)return send(res,502,{error:'Les informations de cette île sont indisponibles.'});
      if(!metricsRes.ok)return send(res,metricsRes.status===429?429:502,{error:metricsRes.status===429?'Limite de requêtes Epic atteinte. Réessaie plus tard.':'Les statistiques de cette île sont temporairement indisponibles.'});
      const [meta,raw]=await Promise.all([metaRes.json(),metricsRes.json()]);
      const lastMetric=value=>Array.isArray(value)?(value.filter(x=>x&&x.value!==null).slice(-1)[0]||null):null;
      const keys=['uniquePlayers','plays','minutesPlayed','peakCCU','averageMinutesPerPlayer','favorites','recommendations'];
      const metrics={};for(const key of keys){const point=lastMetric(raw[key]);metrics[key]=point?{value:point.value,timestamp:point.timestamp}:null;}
      const retention=Array.isArray(raw.retention)?raw.retention.slice(-7):[];
      return send(res,200,{island:{code:meta.code||code,title:meta.title||meta.displayName||'Île Fortnite',creatorCode:meta.creatorCode||null,category:meta.category||null,tags:Array.isArray(meta.tags)?meta.tags:[]},metrics,retention,source:'Epic Games Fortnite Data API',note:'Indicateurs agrégés de l’île, pas statistiques personnelles d’un joueur.'});
    }catch{return send(res,502,{error:'Impossible de joindre l’API officielle Fortnite pour le moment.'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/roblox/lookup'){
    if(limited(req))return send(res,429,{error:'Attends un instant avant une nouvelle recherche.'});
    try{
      const body=await readJson(req),username=String(body.username||'').trim();
      if(!/^[A-Za-z0-9_]{3,20}$/.test(username))return send(res,400,{error:'Pseudo invalide : 3 à 20 lettres, chiffres ou tirets bas.'});
      const lookup=await fetch('https://users.roblox.com/v1/usernames/users',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({usernames:[username],excludeBannedUsers:true})});
      if(!lookup.ok)return send(res,502,{error:'Le service Roblox ne répond pas correctement.'});
      const result=await lookup.json(),found=(result.data||[])[0];if(!found)return send(res,200,{user:null});
      const userRes=await fetch(`https://users.roblox.com/v1/users/${found.id}`,{headers:{'Accept':'application/json'}});
      const profile=userRes.ok?await userRes.json():{};
      const [avatarRes,friendsRes,followersRes,followingRes,gamesRes]=await Promise.all([
        fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${found.id}&size=150x150&format=Png&isCircular=false`).catch(()=>null),
        fetch(`https://friends.roblox.com/v1/users/${found.id}/friends/count`).catch(()=>null),
        fetch(`https://friends.roblox.com/v1/users/${found.id}/followers/count`).catch(()=>null),
        fetch(`https://friends.roblox.com/v1/users/${found.id}/followings/count`).catch(()=>null),
        fetch(`https://games.roblox.com/v2/users/${found.id}/games?accessFilter=Public&sortOrder=Desc&limit=10`).catch(()=>null)
      ]);
      const readSafe=async r=>r&&r.ok?r.json():null;
      const [avatarData,friends,followers,following,games]=await Promise.all([avatarRes,friendsRes,followersRes,followingRes,gamesRes].map(readSafe));
      const avatar=avatarData?.data?.[0]?.imageUrl||null;
      const publicGames=(games?.data||[]).map(g=>({id:g.id,name:g.name,description:g.description||'',playing:g.playing??null,visits:g.visits??null,maxPlayers:g.maxPlayers??null,created:g.created??null,updated:g.updated??null,rootPlaceId:g.rootPlace?.id??g.rootPlaceId??null}));
      return send(res,200,{user:{id:found.id,name:found.name,displayName:found.displayName||profile.displayName||found.name,description:profile.description||'',created:profile.created||null,isBanned:profile.isBanned??null,avatar,friends:friends?.count??null,followers:followers?.count??null,following:following?.count??null,games:publicGames}});
    }catch(err){return send(res,400,{error:err.message||'Requête invalide.'})}
  }
  if(req.method==='GET'&&url.pathname==='/api/rocketleague/live'){
    if(limited(req))return send(res,429,{error:'Attends un instant avant une nouvelle lecture.'});
    const socket=net.createConnection({host:'127.0.0.1',port:49123});let buffer='',done=false;const finish=(status,data)=>{if(done)return;done=true;socket.destroy();send(res,status,data)};
    socket.setTimeout(1200,()=>finish(200,{connected:false,message:'Aucune télémétrie détectée. Lance Rocket League avec la Stats API locale activée.'}));
    socket.on('connect',()=>{});socket.on('data',chunk=>{buffer+=chunk.toString('utf8');const lines=buffer.split(/\r?\n/);buffer=lines.pop()||'';for(const line of lines){try{const packet=JSON.parse(line);if(packet.Event==='UpdateState')return finish(200,{connected:true,event:packet.Event,data:packet.Data})}catch{}}});
    socket.on('error',()=>finish(200,{connected:false,message:'Stats API locale non détectée. Vérifie que Rocket League est ouvert et que la télémétrie est activée.'}));return;
  }
  if(url.pathname.startsWith('/api/'))return send(res,404,{error:'Route API inconnue.'});
  let requested;try{requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}catch{return send(res,400,{error:'URL invalide.'})}
  const file=path.resolve(ROOT,'.'+requested),relative=path.relative(ROOT,file);
  if(relative.startsWith('..')||path.isAbsolute(relative))return send(res,403,{error:'Accès refusé.'});
  fs.readFile(file,(err,content)=>{if(err)return send(res,404,'Page introuvable.','text/plain; charset=utf-8');send(res,200,content,MIME[path.extname(file)]||'application/octet-stream')});
});
server.listen(PORT,()=>console.log(`GameStats 0.7 disponible sur http://localhost:${PORT}`));
