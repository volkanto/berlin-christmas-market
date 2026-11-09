(()=>{
 const root=document.documentElement,system=window.matchMedia('(prefers-color-scheme: dark)');
 const valid=t=>t==='light'||t==='dark';
 const stored=()=>{try{return localStorage.getItem('berlin-market-theme')}catch{return null}};
 let explicit=new URLSearchParams(location.search).get('theme');
 function apply(theme){
  root.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#1e2430':'#f5f4f1';
  const button=document.getElementById('theme-toggle');
  if(button){const label=theme==='dark'?'Switch to light theme':'Switch to dark theme';button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',theme==='dark')}
 }
 apply(valid(explicit)?explicit:valid(stored())?stored():system.matches?'dark':'light');
 document.addEventListener('DOMContentLoaded',()=>{
  apply(root.dataset.theme);
  document.getElementById('theme-toggle').onclick=()=>{
   const theme=root.dataset.theme==='dark'?'light':'dark';explicit=theme;apply(theme);
   try{localStorage.setItem('berlin-market-theme',theme)}catch{}
   const url=new URL(location.href);url.searchParams.set('theme',theme);history.replaceState({},'',url);
  };
 });
 system.addEventListener('change',e=>{if(!valid(explicit)&&!valid(stored()))apply(e.matches?'dark':'light')});
})();
