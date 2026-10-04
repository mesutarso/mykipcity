// Local aliases are allowed only for a loopback demo, on its configured port.
export function applicationOrigins(baseURL=process.env.BETTER_AUTH_URL,demo=process.env.DEMO_MODE==='true'){
 if(!baseURL)throw new Error('Configurer BETTER_AUTH_URL.');
 const url=new URL(baseURL);const origins=[url.origin];
 if(demo&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)){
  const alias=new URL(url);alias.hostname=url.hostname==='localhost'?'127.0.0.1':'localhost';origins.push(alias.origin);
 }
 return origins;
}
