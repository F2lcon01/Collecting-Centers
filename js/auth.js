// Client-side auth using Web Crypto PBKDF2-SHA512
const Auth = (function(){
  function hexToUint8Array(hex){
    if(hex.length % 2 !== 0) hex = '0'+hex;
    const arr = new Uint8Array(hex.length/2);
    for(let i=0;i<hex.length;i+=2) arr[i/2]=parseInt(hex.substr(i,2),16);
    return arr;
  }
  function uint8ArrayToHex(arr){
    return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function deriveHex(password, saltHex, iterations){
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveBits']);
    const salt = hexToUint8Array(saltHex);
    const derived = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations, hash:'SHA-512'}, key, 64*8);
    return uint8ArrayToHex(new Uint8Array(derived));
  }

  async function verify(password){
    try{
      const r = await fetch('data/auth.json', {cache: 'no-store'});
      const cfg = await r.json();
      const got = await deriveHex(password, cfg.salt, cfg.iterations);
      return got === cfg.hash;
    }catch(e){ console.error('Auth verify error',e); return false; }
  }

  async function login(password){
    const ok = await verify(password);
    if(ok){
      // create short session token (not secure across reloads by itself) with expiry
      const expiry = Date.now() + (1000 * 60 * 60); // 1 hour
      sessionStorage.setItem('authenticated','1');
      sessionStorage.setItem('auth_expires', String(expiry));
      window.location.replace('index.html');
    } else {
      const el = document.getElementById('loginMsg');
      if(el) { el.innerText = 'كلمة المرور خاطئة'; el.style.color='salmon'; }
    }
  }

  function isAuthenticated(){
    try{
      const v = sessionStorage.getItem('authenticated');
      const exp = parseInt(sessionStorage.getItem('auth_expires')||'0');
      if(v==='1' && Date.now() < exp) return true;
      sessionStorage.removeItem('authenticated');
      sessionStorage.removeItem('auth_expires');
      return false;
    }catch(e){ return false; }
  }

  function logout(){ sessionStorage.removeItem('authenticated'); sessionStorage.removeItem('auth_expires'); window.location.replace('login.html'); }

  return { login, verify, isAuthenticated, logout };
})();
