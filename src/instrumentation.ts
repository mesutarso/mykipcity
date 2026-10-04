export async function register(){
 if(process.env.NEXT_RUNTIME!=="nodejs"||process.env.MAIL_ENABLED!=="true"||process.env.MAIL_AUTORUN!=="true")return;
 const state=globalThis as typeof globalThis&{kipMailTimer?:ReturnType<typeof setInterval>};if(state.kipMailTimer)return;
 const {prepareReminders}=await import("./lib/reminders"),{deliverMail}=await import("./lib/mail");let running=false;
 const run=async()=>{if(running)return;running=true;try{await prepareReminders();await deliverMail();}catch{console.error("mail_worker_failed");}finally{running=false;}};
 state.kipMailTimer=setInterval(()=>{void run();},60000);state.kipMailTimer.unref();
}
