// Mail website settings are read before any environment patch is installed.
const mailProviders = [
  {id:'gmail',name:'Gmail',hosts:['mail.google.com']},
  {id:'outlook',name:'Outlook / Hotmail',hosts:['outlook.live.com','outlook.office.com','outlook.office365.com','outlook.cloud.microsoft']},
  {id:'yahoo',name:'Yahoo Mail',hosts:['mail.yahoo.com']},
  {id:'icloud',name:'iCloud Mail',hosts:['www.icloud.com'],path:'/mail'},
  {id:'proton',name:'Proton Mail',hosts:['mail.proton.me']},
  {id:'tuta',name:'Tuta Mail',hosts:['app.tuta.com']},
  {id:'fastmail',name:'Fastmail',hosts:['app.fastmail.com']},
  {id:'zoho',name:'Zoho Mail',hosts:['mail.zoho.com']},
  {id:'aol',name:'AOL Mail',hosts:['mail.aol.com']},
  {id:'gmx',name:'GMX Mail',hosts:['mail.gmx.com','www.gmx.net']},
  {id:'hey',name:'HEY Mail',hosts:['app.hey.com']},
  {id:'yandex',name:'Yandex Mail',hosts:['mail.yandex.com','mail.yandex.ru']},
  {id:'qq',name:'QQ Mail',hosts:['mail.qq.com']},
  {id:'netease',name:'NetEase Mail',hosts:['mail.163.com','mail.126.com','mail.yeah.net']},
  {id:'sina',name:'Sina Mail',hosts:['mail.sina.com.cn']},
  {id:'naver',name:'Naver Mail',hosts:['mail.naver.com']},
];
const mailFeatureLabels={timezone:'Timezone',language:'Language / Locale / Region',fonts:'Font Protection',network:'Network Checks'};
function detectMailProvider(host=location.hostname,path=location.pathname) {
  const name=String(host).toLowerCase();
  return mailProviders.find(item=>item.hosts.includes(name)&&(!item.path||String(path).startsWith(item.path)))||null;
}
function normalizeMailSites(raw) {
  const data=raw&&typeof raw==='object'?raw:{};
  return Object.fromEntries(mailProviders.map(item=>{
    const entry=data[item.id]&&typeof data[item.id]==='object'?data[item.id]:{};
    const flags=entry.features&&typeof entry.features==='object'?entry.features:{};
    return [item.id,{enabled:entry.enabled===true,
      features:Object.fromEntries(Object.keys(mailFeatureLabels).map(key=>[key,flags[key]!==false]))}];
  }));
}
