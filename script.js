/* CENTRAL CONFIG */
const CFG = {
    brand: 'FracShr',
    web3forms: { accessKey: '27183595-25e6-4c36-93ba-8c855c7763eb', api: 'https://api.web3forms.com/submit' },
    otp: { expiryMs: 5*60*1000, resendMs: 45*1000 },
    emailjs: { publicKey: '6BWuApUnhyOgHXQ5q', serviceId: 'service_63pnjrq', templateId: 'template_hi01far', endpoint: 'https://api.emailjs.com/api/v1.0/email/send' }
};

/* Utilities */
function setVH(){ document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); }
setVH(); window.addEventListener('resize', setVH); window.addEventListener('orientationchange', ()=> setTimeout(setVH, 200));
document.getElementById('year').textContent = new Date().getFullYear();
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v||'').trim());
const debounce = (fn, ms)=>{ let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=> fn.apply(this,args), ms); }; };
const nowIso = ()=> new Date().toISOString();

/* Scroll lock when modal/menu open */
function updateBodyScrollLock(){
  const anyModalOpen = ['waitlistModal','otpModal','successModal','demoModal'].some(id=> document.getElementById(id)?.classList.contains('active'));
  const menuOpen = document.body.classList.contains('menu-open');
  document.body.classList.toggle('no-scroll', anyModalOpen || menuOpen);
}
function setDialogState(el, open){
  if(!el) return;
  el.classList.toggle('active', open);
  el.setAttribute('aria-hidden', open ? 'false' : 'true');
  updateBodyScrollLock();
}

/* Header menu */
const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');
menuBtn?.addEventListener('click', ()=>{
  const open = !navLinks.classList.contains('open');
  navLinks.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open?'true':'false');
  document.body.classList.toggle('menu-open', open);
  updateBodyScrollLock();
});
navLinks?.addEventListener('click', (e)=>{
  if(e.target.closest('a,button')){
    navLinks.classList.remove('open');
    document.body.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded','false');
    updateBodyScrollLock();
  }
});

/* Reveal on scroll */
const revealEls=document.querySelectorAll('.reveal');
const io=new IntersectionObserver(entries=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); }});
},{threshold:.12});
revealEls.forEach(el=>io.observe(el));

/* Sticky CTA */
const stickyCTA=document.getElementById('stickyCTA');
const closeStickyCTA=document.getElementById('closeStickyCTA');
function showStickyCTA(){ if (localStorage.getItem('fracshr_waitlisted_verified')!=='1' && localStorage.getItem('fracshr_hide_sticky')!=='1') stickyCTA.classList.remove('hidden'); }
function hideStickyCTA(persist=false){ stickyCTA.classList.add('hidden'); if(persist){ try{ localStorage.setItem('fracshr_hide_sticky','1'); }catch(e){} } }
closeStickyCTA?.addEventListener('click', ()=> hideStickyCTA(true));
setTimeout(showStickyCTA, 15000);

/* Modals + focus trap */
const waitlistModal=document.getElementById('waitlistModal');
const otpModal=document.getElementById('otpModal');
const successModal=document.getElementById('successModal');
function trapFocus(modal){
  function handler(e){
    if (e.key !== 'Tab') return;
    const focusables = modal.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const list = Array.from(focusables).filter(el=> !el.hasAttribute('disabled'));
    if (!list.length) return;
    const first = list[0], last = list[list.length-1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
  modal.addEventListener('keydown', handler);
  return ()=> modal.removeEventListener('keydown', handler);
}
let untrapWaitlist=null, untrapOtp=null, untrapSuccess=null;
const openWaitlist = ()=> { setDialogState(waitlistModal, true); setTimeout(()=> document.getElementById('waitlistEmail')?.focus(), 0); untrapWaitlist = trapFocus(waitlistModal); };
const closeWaitlist = ()=> { setDialogState(waitlistModal, false); if(untrapWaitlist){ untrapWaitlist(); untrapWaitlist=null; } };
const openOtp = ()=> { setDialogState(otpModal, true); setTimeout(()=> document.getElementById('otpEmail')?.focus(), 0); untrapOtp = trapFocus(otpModal); };
const closeOtp = ()=> { setDialogState(otpModal, false); if(untrapOtp){ untrapOtp(); untrapOtp=null; } };
const openSuccess = ()=> { setDialogState(successModal, true); setTimeout(()=> document.getElementById('successClose')?.focus(), 0); untrapSuccess = trapFocus(successModal); };
const closeSuccess = ()=> { setDialogState(successModal, false); if(untrapSuccess){ untrapSuccess(); untrapSuccess=null; } };

/* OTP + Web3Forms */
let OTP_STATE = { email:null, code:null, expires:0, resendAt:0, source:'Unknown' };
const wlStatus = document.getElementById('wlStatus'); const otpEmailEl = document.getElementById('otpEmail'); const otpCodeEl = document.getElementById('otpCode'); const otpStatus = document.getElementById('otpStatus'); const sendOtpBtn = document.getElementById('sendOtpBtn'); const verifyOtpBtn = document.getElementById('verifyOtpBtn');
function generateCode(){ return String(Math.floor(100000 + Math.random()*900000)); }
async function sendEmailJS(to, subject, message, templateVars={}){ const payload = { service_id: CFG.emailjs.serviceId, template_id: CFG.emailjs.templateId, user_id: CFG.emailjs.publicKey, template_params: { to_email: to, subject, message, otp: templateVars.otp || '', site_name: CFG.brand } }; const res = await fetch(CFG.emailjs.endpoint, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) }); if(!res.ok) throw new Error('EmailJS REST failed: ' + res.status); return res.text(); }
function beginWaitlist(inputId, source, hpId){ const el = document.getElementById(inputId); const email = (el?.value||'').trim(); const hp = (document.getElementById(hpId)?.value||'').trim(); if (!validEmail(email)) { el?.focus(); if (el) { el.style.borderColor='#FF4D8D'; setTimeout(()=> el.style.borderColor='rgba(255,255,255,.1)', 1500); } wlStatus.textContent = 'Please enter a valid email.'; return; } if (hp) { closeWaitlist(); return; } OTP_STATE.source = source||'Waitlist'; otpEmailEl.value = email; closeWaitlist(); openOtp(); sendOTP(true); }
async function sendOTP(auto=false){ const email = (otpEmailEl.value||'').trim(); if (!validEmail(email)) { otpEmailEl.focus(); otpEmailEl.style.borderColor = '#FF4D8D'; setTimeout(()=> otpEmailEl.style.borderColor='rgba(255,255,255,.1)', 1500); return; } const now = Date.now(); if(!auto && now < OTP_STATE.resendAt){ const secs = Math.ceil((OTP_STATE.resendAt - now)/1000); otpStatus.textContent = `Please wait ${secs}s to resend.`; return; } const code = generateCode(); OTP_STATE.email = email; OTP_STATE.code = code; OTP_STATE.expires = now + CFG.otp.expiryMs; OTP_STATE.resendAt = now + CFG.otp.resendMs; otpStatus.textContent = 'Sending code...'; const minutes = Math.round(CFG.otp.expiryMs/60000); const subject = `${CFG.brand} verification code: ${code}`; const text = `Hello ${email}\n\nYour one-time verification code for ${CFG.brand} is: ${code}.\nThis code expires in ${minutes} minutes. If you didn’t request this, ignore this email.\n\n— ${CFG.brand} Team`; try{ await sendEmailJS(email, subject, text, { otp: code }); otpStatus.textContent = `OTP sent to ${email}. Code valid for ${minutes} minutes.`; }catch(err){ otpStatus.textContent = 'Could not send OTP. Please try again later.'; } }
async function verifyOTP(){ const entered = (otpCodeEl.value||'').trim(); const now = Date.now(); if (!OTP_STATE.code || now > OTP_STATE.expires) { otpStatus.textContent = 'Code expired. Please resend a new OTP.'; return; } if (entered !== OTP_STATE.code) { otpStatus.textContent = 'Invalid code. Please try again.'; otpCodeEl.focus(); return; } closeOtp(); await submitWeb3Forms(OTP_STATE.email, OTP_STATE.source); try{ localStorage.setItem('fracshr_waitlisted_verified','1'); }catch(e){} openSuccess(); hideStickyCTA(true); }
async function submitWeb3Forms(email, source){ const payload = { access_key: CFG.web3forms.accessKey, subject: 'New verified waitlist signup — ' + CFG.brand, from_name: `${CFG.brand} Site`, email, message: `New verified signup\nEmail: ${email}\nSource: ${source}\nTime: ${nowIso()}\nUser Agent: ${navigator.userAgent}\nReferrer: ${document.referrer}`, page_url: location.href, referrer: document.referrer, user_agent: navigator.userAgent }; try{ await fetch(CFG.web3forms.api, { method:'POST', headers: { 'Content-Type':'application/json', 'Accept':'application/json' }, body: JSON.stringify(payload), cache: 'no-store', redirect: 'follow' }); }catch(e){ /* ignore */ } }

/* DEMO GAME LOGIC */
const demoGame = (() => {
    const demoModal=document.getElementById('demoModal');
    if (!demoModal) return { open: () => {}, close: () => {} };
    const priceLabel=document.getElementById('priceLabel'); const priceNote=document.getElementById('priceNote'); const cashLabel=document.getElementById('cashLabel'); const holdingsLabel=document.getElementById('holdingsLabel'); const portfolioLabel=document.getElementById('portfolioLabel'); const pnlLabel=document.getElementById('pnlLabel'); const buyBtn=document.getElementById('buyBtn'); const sellBtn=document.getElementById('sellBtn'); const nextBtn=document.getElementById('nextBtn'); const qtyInput=document.getElementById('qtyInput'); const resetDemoBtn=document.getElementById('resetDemo'); const levelComplete=document.getElementById('levelComplete'); const coachMsg=document.getElementById('coachMsg'); const hintBuy = document.getElementById('hintBuy'); const hintSell = document.getElementById('hintSell'); const hintNext = document.getElementById('hintNext'); const coachBox = document.getElementById('coachBox'); const coachToggle = document.getElementById('coachToggle');
    let demoState=null, guideTimer=null, idleTimeout=null, bars=[]; const MAX_BARS=80; let demoOpen=false;
    const css = getComputedStyle(document.documentElement); const COLORS = { up: css.getPropertyValue('--up').trim() || '#20e3b2', down: css.getPropertyValue('--down').trim() || '#ff6b88', sma10: css.getPropertyValue('--accent5').trim() || '#FFC857', sma20: css.getPropertyValue('--accent1').trim() || '#2DE2E6' };
    const priceCanvas=document.getElementById('priceCanvas'); const rsiCanvas=document.getElementById('rsiCanvas'); let pctx, rctx, dpr, ro;
    
    function open(){ demoOpen=true; setDialogState(demoModal, true); init(); setCoachCollapsed(window.innerHeight < 780); }
    function close(){ demoOpen=false; setDialogState(demoModal, false); stopIdle(); stopGuide(); if(ro){ try{ ro.disconnect(); }catch(e){} ro=null; } pctx = null; rctx = null; clearHints(); }
    
    document.getElementById('demoClose')?.addEventListener('click', close); 
    document.getElementById('closeDemoFromComplete')?.addEventListener('click', close); 
    resetDemoBtn?.addEventListener('click', ()=> { init(); });

    function init(){ stopIdle(); stopGuide(); levelComplete.classList.remove('active'); bars=[]; demoState={ step:0, marketPrice:100.00, useLockedPrice:false, lockedPrice:null, cash:10000.00, holdings:0, avgPrice:0, realizedPnL:0, goal:11000.00, startCash:10000.00 }; qtyInput.value=100; qtyInput.disabled=true; buyBtn.classList.add('btn-disabled'); sellBtn.classList.add('btn-disabled'); nextBtn.classList.remove('hidden'); nextBtn.textContent='Next ▶'; nextBtn.classList.add('suggested'); showCoach("Welcome! I’m your coach. Tap Next and I’ll walk you through a winning trade."); clearHints(); hintNext.classList.add('show'); if (!pctx) setupCanvases(); generateInitialBars(); drawAll(); updateUI(); startIdle(); }
    function setupCanvases(){ dpr=window.devicePixelRatio||1; pctx=priceCanvas.getContext('2d'); rctx=rsiCanvas.getContext('2d'); const resize = debounce(() => { if (!priceCanvas.parentElement || !rsiCanvas.parentElement) return; const rectP = priceCanvas.parentElement.getBoundingClientRect(); const rectR = rsiCanvas.parentElement.getBoundingClientRect(); priceCanvas.width = Math.round(rectP.width * dpr); priceCanvas.height = Math.round(rectP.height * dpr); rsiCanvas.width = Math.round(rectR.width * dpr); rsiCanvas.height = Math.round(rectR.height * dpr); pctx.setTransform(dpr, 0, 0, dpr, 0, 0); rctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawAll(); }, 100); resize(); if(!ro){ ro = new ResizeObserver(resize); } ro.observe(document.querySelector('.phone')); }
    function generateInitialBars(){ let last=100; for(let i=0;i<30;i++){ const o=last; const delta=(Math.random()-.5)*0.5; const c=o+delta; const h=Math.max(o,c)+Math.random()*0.3; const l=Math.min(o,c)-Math.random()*0.3; bars.push({o,h,l,c}); last=c; } demoState.marketPrice = bars[bars.length-1].c; }
    function SMA(closes, period){ const out=new Array(closes.length).fill(null); let sum=0; for(let i=0;i<closes.length;i++){ sum+=closes[i]; if(i>=period) sum-=closes[i-period]; if(i>=period-1) out[i]=sum/period; } return out; }
    function RSI(closes, period=14){ const out=new Array(closes.length).fill(null); if (closes.length < period+1) return out; let gains=0, losses=0; for(let i=1;i<=period;i++){ const diff=closes[i]-closes[i-1]; if(diff>=0) gains+=diff; else losses+=-diff; } let avgGain=gains/period, avgLoss=losses/period; out[period]= 100 - (100/(1 + (avgGain/(avgLoss||1e-6)))); for(let i=period+1;i<closes.length;i++){ const diff=closes[i]-closes[i-1]; const gain= diff>0?diff:0; const loss= diff<0?-diff:0; avgGain = (avgGain*(period-1) + gain)/period; avgLoss = (avgLoss*(period-1) + loss)/period; const rs = avgGain/(avgLoss||1e-6); out[i]= 100 - (100/(1+rs)); } return out; }
    function getCloses(){ return bars.map(b=>b.c); }
    function drawAll(){ if (!pctx || !rctx || !demoOpen) return; drawPriceChart(); drawRSIChart(); }
    function drawPriceChart(){ const w=priceCanvas.parentElement.clientWidth; const h=priceCanvas.parentElement.clientHeight; pctx.clearRect(0,0,w,h); pctx.strokeStyle='rgba(255,255,255,.06)'; pctx.lineWidth=1; for(let i=0;i<=5;i++){ pctx.beginPath(); pctx.moveTo(0,i*(h/5)); pctx.lineTo(w,i*(h/5)); pctx.stroke(); } const PADDING=10; const visible=bars.slice(-50); if (visible.length === 0) return; const highs=visible.map(b=>b.h), lows=visible.map(b=>b.l); const min=Math.min(...lows); const max=Math.max(...highs); const range=(max-min)||1; const cw=w - PADDING*2; const ch=h - PADDING*2; const bw = Math.max(2, cw/visible.length - 2); const closes=visible.map(b=>b.c); const sma10=SMA(closes,10), sma20=SMA(closes,20); function yFor(v){ return h - PADDING - ((v - min)/range)*ch; } visible.forEach((b, i)=>{ const x = PADDING + i*(cw/visible.length) + 1; pctx.strokeStyle='rgba(255,255,255,.35)'; pctx.beginPath(); pctx.moveTo(x+bw/2, yFor(b.h)); pctx.lineTo(x+bw/2, yFor(b.l)); pctx.stroke(); const up=b.c>=b.o; pctx.fillStyle = up ? COLORS.up : COLORS.down; const top = yFor(up?b.c:b.o); const bottom = yFor(up?b.o:b.c); const height=Math.max(1, bottom - top); pctx.fillRect(x, top, bw, height); }); pctx.lineWidth=2; pctx.strokeStyle=COLORS.sma10; pctx.beginPath(); sma10.forEach((v,i)=>{ if(v==null) return; const x=PADDING + i*(cw/sma10.length) + bw/2; const y=yFor(v); if(i===0||sma10[i-1]==null) pctx.moveTo(x,y); else pctx.lineTo(x,y);}); pctx.stroke(); pctx.lineWidth=2; pctx.strokeStyle=COLORS.sma20; pctx.beginPath(); sma20.forEach((v,i)=>{ if(v==null) return; const x=PADDING + i*(cw/sma20.length) + bw/2; const y=yFor(v); if(i===0||sma20[i-1]==null) pctx.moveTo(x,y); else pctx.lineTo(x,y);}); pctx.stroke(); }
    function drawRSIChart(){ const w=rsiCanvas.parentElement.clientWidth; const h=rsiCanvas.parentElement.clientHeight; rctx.clearRect(0,0,w,h); rctx.strokeStyle='rgba(255,255,255,.06)'; rctx.lineWidth=1; for(let i=0;i<=4;i++){ rctx.beginPath(); rctx.moveTo(0,i*(h/4)); rctx.lineTo(w,i*(h/4)); rctx.stroke(); } const closes=getCloses().slice(-50); const rsiArr=RSI(closes,14); if (rsiArr.length === 0) return; function yForRSI(v){ return h - (v/100)*h; } rctx.fillStyle='rgba(255,77,141,.08)'; rctx.fillRect(0, 0, w, yForRSI(70)); rctx.fillStyle='rgba(32,227,178,.08)'; rctx.fillRect(0, yForRSI(30), w, h - yForRSI(30)); rctx.strokeStyle='rgba(255,255,255,.25)'; [70,50,30].forEach(v=>{ rctx.beginPath(); rctx.moveTo(0, yForRSI(v)); rctx.lineTo(w, yForRSI(v)); rctx.stroke(); }); rctx.strokeStyle=COLORS.sma10; rctx.lineWidth=2; rctx.beginPath(); rsiArr.forEach((v,i)=>{ if(v==null) return; const x = (i/(rsiArr.length-1)) * (w-10) + 5; const y = yForRSI(v); if(i===0||rsiArr[i-1]==null) rctx.moveTo(x,y); else pctx.lineTo(x,y);}); pctx.stroke(); }
    function addBar(nextClose){ const last=bars[bars.length-1]||{c:100}; const o=last.c; const c=Number(nextClose.toFixed(2)); const h=Math.max(o,c)+Math.random()*0.25; const l=Math.min(o,c)-Math.random()*0.25; bars.push({o,h,l,c}); if(bars.length>MAX_BARS) bars.shift(); demoState.marketPrice=c; }
    
    // --- PERFORMANCE OPTIMIZATION: Use requestAnimationFrame for animations ---
    let lastTickTime = 0;
    function idleTick(timestamp){
        if(!demoOpen) return;
        
        if (timestamp - lastTickTime > 1200) { // Approx. every 1.2 seconds
            const last=bars[bars.length-1]?.c||100;
            const next= last + (Math.random()-.5)*0.25;
            addBar(next);
            drawAll();
            updateUI();
            lastTickTime = timestamp;
        }
        idleTimeout = requestAnimationFrame(idleTick);
    }
    function startIdle(){ stopIdle(); idleTimeout = requestAnimationFrame(idleTick); }
    function stopIdle(){ if(idleTimeout){ cancelAnimationFrame(idleTimeout); idleTimeout=null; } }
    
    function getUsedPrice(){ return demoState.useLockedPrice ? demoState.lockedPrice : demoState.marketPrice; }
    function updateUI(){ const usedPrice = getUsedPrice(); priceLabel.textContent = '$' + usedPrice.toFixed(2); priceNote.classList.toggle('hidden', !demoState.useLockedPrice); cashLabel.textContent = '$' + demoState.cash.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); holdingsLabel.textContent = String(demoState.holdings); const portfolio = demoState.cash + demoState.holdings * usedPrice; portfolioLabel.textContent = '$' + portfolio.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); const unreal = demoState.holdings>0 ? (usedPrice - demoState.avgPrice)*demoState.holdings : 0; const totalPNL = demoState.realizedPnL + unreal; pnlLabel.textContent = (totalPNL>=0?'+':'-') + '$' + Math.abs(totalPNL).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); pnlLabel.style.color = totalPNL>=0 ? 'var(--up)' : 'var(--down)'; }
    function showCoach(t){ coachMsg.textContent=t; }
    function clearHints(){ [hintBuy, hintSell, hintNext].forEach(h=> h.classList.remove('show')); [buyBtn,sellBtn,nextBtn].forEach(b=> b.classList.remove('suggested')); }
    function setCoachCollapsed(collapsed){ coachBox.classList.toggle('collapsed', collapsed); coachToggle.setAttribute('aria-expanded', (!collapsed).toString()); coachToggle.textContent = collapsed ? 'Show Coach' : 'Hide Coach'; }
    coachToggle?.addEventListener('click', ()=> setCoachCollapsed(!coachBox.classList.contains('collapsed')));
    nextBtn?.addEventListener('click', ()=>{ switch(demoState.step){ case 0: demoState.step=1; qtyInput.disabled=false; qtyInput.value=100; buyBtn.classList.remove('btn-disabled'); buyBtn.classList.add('suggested'); showCoach("Step 1: Set quantity to 100 and tap BUY to open a position."); nextBtn.classList.add('hidden'); clearHints(); hintBuy.classList.add('show'); break; case 2: demoState.step=3; demoState.useLockedPrice = false; showCoach("Step 2: Watch the price move to your target. I’ll do the lifting—just observe."); nextBtn.classList.add('hidden'); clearHints(); startGuidedRise(); break; case 4: demoState.step=5; sellBtn.classList.remove('btn-disabled'); sellBtn.classList.add('suggested'); showCoach("Step 3: Tap SELL to lock in your profit and finish the level."); nextBtn.classList.add('hidden'); clearHints(); hintSell.classList.add('show'); break; } });
    buyBtn?.addEventListener('click', ()=>{ if(buyBtn.classList.contains('btn-disabled')) return; let qty=Math.max(1, Math.floor(Number(qtyInput.value)||0)); if(qty !== 100){ qtyInput.value = 100; showCoach("For this demo, buy 100 shares. I’ve set it for you—tap BUY again."); return; } const buyPrice = 100.00; const cost=qty * buyPrice; if(cost>demoState.cash){ showCoach("Not enough cash. Reduce quantity or reset."); return; } demoState.cash-=cost; demoState.holdings+=qty; demoState.avgPrice=buyPrice; demoState.useLockedPrice = true; demoState.lockedPrice = 100.00; updateUI(); drawAll(); buyBtn.classList.add('btn-disabled'); buyBtn.classList.remove('suggested'); qtyInput.disabled=true; demoState.step=2; showCoach("Great entry. Price is locked for clarity. Tap Next to continue."); nextBtn.classList.remove('hidden'); nextBtn.classList.add('suggested'); clearHints(); hintNext.classList.add('show'); });
    
    // --- PERFORMANCE OPTIMIZATION: Use requestAnimationFrame for guided animation ---
    function startGuidedRise(){ 
        stopIdle(); 
        const target=111.00; 
        const duration = 12 * 950; // Total duration: 11.4 seconds
        let startTimestamp = null;

        function step(timestamp) {
            if(!demoOpen){ stopGuide(); return; }
            if (!startTimestamp) startTimestamp = timestamp;
            
            const elapsed = timestamp - startTimestamp;
            const progress = Math.min(elapsed / duration, 1);
            
            const last=bars[bars.length-1]?.c || 100;
            const currentTargetPrice = 100 + (target - 100) * progress;
            const next = currentTargetPrice + (Math.random() - 0.5) * 0.1;
            
            addBar(next);
            drawAll();
            updateUI();

            if (progress < 1) {
                guideTimer = requestAnimationFrame(step);
            } else {
                stopGuide();
                demoState.marketPrice = target;
                drawAll(); updateUI();
                demoState.step=4; 
                showCoach("Nice! You’re in profit. Tap Next for the final step."); 
                nextBtn.classList.remove('hidden'); 
                nextBtn.classList.add('suggested'); 
                clearHints(); 
                hintNext.classList.add('show'); 
                startIdle();
            }
        }
        guideTimer = requestAnimationFrame(step);
    }
    function stopGuide(){ if(guideTimer){ cancelAnimationFrame(guideTimer); guideTimer=null; } }
    
    sellBtn?.addEventListener('click', ()=>{ if(sellBtn.classList.contains('btn-disabled')) return; if(demoState.holdings<=0) return; const sellPrice = demoState.marketPrice; const revenue = demoState.holdings * sellPrice; const costBasis = demoState.holdings * demoState.avgPrice; const pl = revenue - costBasis; demoState.cash += revenue; demoState.realizedPnL += pl; demoState.holdings = 0; updateUI(); const portfolio = demoState.cash; if(portfolio >= demoState.goal){ setTimeout(()=> { fillSummary(); levelComplete.classList.add('active'); }, 500); }else{ showCoach("Almost there! Try another trade or reset the demo."); } sellBtn.classList.add('btn-disabled'); sellBtn.classList.remove('suggested'); clearHints(); });
    function fillSummary(){ const start = demoState.startCash; const final = demoState.cash + demoState.holdings*getUsedPrice(); const profit = final - start; const roi = (profit / start) * 100; const barsHeld = 12; const beat = final - demoState.goal; document.getElementById('sumStart').textContent = '$' + start.toFixed(2); document.getElementById('sumFinal').textContent = '$' + final.toFixed(2); document.getElementById('sumProfit').textContent = (profit>=0?'+':'-') + '$' + Math.abs(profit).toFixed(2); document.getElementById('sumROI').textContent = (roi>=0?'+':'') + roi.toFixed(2) + '%'; document.getElementById('sumEntry').textContent = `100 @ $100.00`; document.getElementById('sumExit').textContent = `100 @ $111.00`; document.getElementById('sumBars').textContent = String(Math.max(0, barsHeld)); document.getElementById('sumRSI').textContent = '— → —'; document.getElementById('sumBeat').textContent = (beat>=0?'+':'-') + '$' + Math.abs(beat).toFixed(2); document.getElementById('sumImpact').textContent = `+ $11 move × 100 shares = +$1,100`; }
    document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ stopIdle(); stopGuide(); } else if(demoOpen){ startIdle(); } });
    
    return { open, close };
})();

/* === Comprehensive Event Binding === */
// Play Demo Buttons
const playDemoButtonIds = ['playDemoTop', 'playDemoHero', 'playDemoCard', 'playDemoLevels', 'playDemoChallenges'];
playDemoButtonIds.forEach(id => document.getElementById(id)?.addEventListener('click', demoGame.open));

// Open Waitlist Modal Buttons
const openWaitlistButtonIds = ['openWaitlistTop', 'openWaitlistHero', 'openWaitlistCard', 'openWaitlistLevels', 'openWaitlistWar', 'openWaitlistChallenges'];
openWaitlistButtonIds.forEach(id => document.getElementById(id)?.addEventListener('click', openWaitlist));

// Waitlist Submission Buttons (Trigger OTP flow)
document.getElementById('joinWaitlist')?.addEventListener('click', () => beginWaitlist('waitlistEmail', 'Modal', 'hp_field'));
document.getElementById('joinWaitlistBottom')?.addEventListener('click', () => beginWaitlist('waitlistEmailBottom', 'Bottom Form', 'hp_field_bottom'));
document.getElementById('joinWaitlistSticky')?.addEventListener('click', () => beginWaitlist('waitlistEmailSticky', 'Sticky CTA', 'hp_field_sticky'));

// Modal Close Buttons
document.getElementById('closeWaitlist')?.addEventListener('click', closeWaitlist);
document.getElementById('closeOtp')?.addEventListener('click', closeOtp);
document.getElementById('cancelOtpBtn')?.addEventListener('click', closeOtp);
document.getElementById('successClose')?.addEventListener('click', closeSuccess);

// OTP Flow Control Buttons
document.getElementById('sendOtpBtn')?.addEventListener('click', () => sendOTP(false));
document.getElementById('verifyOtpBtn')?.addEventListener('click', verifyOTP);

// Post-Action / Cross-Modal Buttons
document.getElementById('openWaitlistFromComplete')?.addEventListener('click', () => {
    demoGame.close();
    openWaitlist();
});
document.getElementById('successPlayDemo')?.addEventListener('click', () => {
    closeSuccess();
    demoGame.open();
});
