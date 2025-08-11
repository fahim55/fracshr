document.addEventListener('DOMContentLoaded', () => {

    /* CENTRAL CONFIGURATION */
    const CFG = {
        brand: 'FracShr',
        web3forms: {
            accessKey: '27183595-25e6-4c36-93ba-8c855c7763eb',
            api: 'https://api.web3forms.com/submit'
        },
        otp: {
            required: true,
            expiryMs: 5 * 60 * 1000,
            resendMs: 45 * 1000
        },
        emailjs: {
            publicKey: '6BWuApUnhyOgHXQ5q',
            serviceId: 'service_63pnjrq',
            templateId: 'template_hi01far',
        }
    };

    /* UTILITY FUNCTIONS */
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);
    const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
    const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); }; };
    
    setVH();
    window.addEventListener('resize', setVH);
    $('#year').textContent = new Date().getFullYear();

    /* MOBILE MENU LOGIC */
    const menuBtn = $('#menuBtn');
    const navLinks = $('#navLinks');
    menuBtn?.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', isOpen);
        document.body.classList.toggle('menu-open', isOpen);
    });
    navLinks.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) {
            navLinks.classList.remove('open');
            document.body.classList.remove('menu-open');
            menuBtn.setAttribute('aria-expanded', 'false');
        }
    });

    /* BACKGROUND CANDLES (MEMORY LEAK FIXED) */
    const bgCandles = $('#bgCandles');
    function spawnCandles(count) {
        if (!bgCandles) return;
        for (let i = 0; i < count; i++) {
            const candle = document.createElement('div');
            candle.className = 'candle';
            const duration = 8 + Math.random() * 12;
            candle.style.left = `${Math.random() * 100}vw`;
            candle.style.animationDuration = `${duration}s`;
            candle.style.animationDelay = `${Math.random() * 6}s`;
            candle.style.opacity = String(0.2 + Math.random() * 0.35);
            bgCandles.appendChild(candle);
            // **FIX**: Remove candle after its animation ends to prevent memory leak
            setTimeout(() => candle.remove(), duration * 1000 + 1000);
        }
    }
    spawnCandles(30);
    setInterval(() => spawnCandles(3), 3000);

    /* REVEAL ON SCROLL */
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    $$('.reveal').forEach(el => revealObserver.observe(el));

    /* STICKY CTA LOGIC */
    const stickyCTA = $('#stickyCTA');
    const showStickyCTA = () => {
        if (localStorage.getItem('fracshr_hide_sticky') !== '1' && localStorage.getItem('fracshr_waitlisted_verified') !== '1') {
            stickyCTA.classList.remove('hidden');
        }
    };
    $('#closeStickyCTA')?.addEventListener('click', () => {
        stickyCTA.classList.add('hidden');
        try { localStorage.setItem('fracshr_hide_sticky', '1'); } catch (e) { console.error(e); }
    });
    setTimeout(showStickyCTA, 15000);

    /* MODAL HANDLING */
    const modals = {
        waitlist: $('#waitlistModal'),
        otp: $('#otpModal'),
        success: $('#successModal'),
        demo: $('#demoModal')
    };
    const openModal = (name) => modals[name]?.classList.add('active');
    const closeModal = (name) => modals[name]?.classList.remove('active');
    
    // Setup event listeners for opening/closing modals
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.js-open-waitlist')) openModal('waitlist');
        if (target.closest('.js-play-demo')) { openModal('demo'); initDemo(); }
        if (target.id === 'closeWaitlist' || target.closest('.waitlist-modal') === modals.waitlist && target.classList.contains('waitlist-modal')) closeModal('waitlist');
        if (target.id === 'closeOtp' || target.id === 'cancelOtpBtn' || target.closest('.waitlist-modal') === modals.otp && target.classList.contains('waitlist-modal')) closeModal('otp');
        if (target.id === 'successClose' || target.closest('.waitlist-modal') === modals.success && target.classList.contains('waitlist-modal')) closeModal('success');
        if (target.id === 'demoClose' || target.id === 'closeDemoFromComplete' || target.closest('.demo-modal') === modals.demo && target.classList.contains('demo-modal')) closeDemo();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modals.waitlist.classList.contains('active')) closeModal('waitlist');
            else if (modals.otp.classList.contains('active')) closeModal('otp');
            else if (modals.success.classList.contains('active')) closeModal('success');
            else if (modals.demo.classList.contains('active')) closeDemo();
        }
    });

    /* WAITLIST & OTP FORM LOGIC */
    const otpState = { email: null, code: null, expires: 0, resendAt: 0, source: 'Unknown' };
    const otpEmailEl = $('#otpEmail');
    const otpCodeEl = $('#otpCode');
    const otpStatus = $('#otpStatus');

    window.addEventListener('load', () => window.emailjs?.init(CFG.emailjs.publicKey));

    const beginWaitlist = (email, source) => {
        if ($('#hp_field').value) return; // Honeypot check
        closeModal('waitlist');
        otpEmailEl.value = email;
        otpState.source = source;
        openModal('otp');
        sendOTP(true);
    };

    $$('#joinWaitlist, #joinWaitlistBottom, #joinWaitlistSticky').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const inputId = e.target.previousElementSibling.id;
            const source = e.target.id.includes('Bottom') ? 'Bottom CTA' : e.target.id.includes('Sticky') ? 'Sticky CTA' : 'Modal';
            const emailInput = $(`#${inputId}`);
            const email = emailInput.value;
            if (validEmail(email)) {
                beginWaitlist(email, source);
            } else {
                emailInput.focus();
                emailInput.style.borderColor = 'var(--accent3)';
                setTimeout(() => emailInput.style.borderColor = '', 1500);
            }
        });
    });

    async function sendOTP(auto = false) {
        const email = otpEmailEl.value;
        if (!validEmail(email)) { /* handled by button click */ return; }
        const now = Date.now();
        if (!auto && now < otpState.resendAt) {
            otpStatus.textContent = `Please wait ${Math.ceil((otpState.resendAt - now) / 1000)}s.`;
            return;
        }

        otpState.code = String(Math.floor(100000 + Math.random() * 900000));
        otpState.email = email;
        otpState.expires = now + CFG.otp.expiryMs;
        otpState.resendAt = now + CFG.otp.resendMs;

        otpStatus.textContent = 'Sending code...';
        try {
            await window.emailjs.send(CFG.emailjs.serviceId, CFG.emailjs.templateId, {
                to_email: email,
                subject: `${CFG.brand} verification code: ${otpState.code}`,
                message: `Your one-time verification code for ${CFG.brand} is: ${otpState.code}.\nThis code expires in ${Math.round(CFG.otp.expiryMs / 60000)} minutes.`,
                otp: otpState.code,
                site_name: CFG.brand,
            });
            otpStatus.textContent = `Code sent to ${email}.`;
        } catch (err) {
            console.error(err);
            otpStatus.textContent = 'Could not send OTP. Please try again.';
        }
    }

    async function verifyOTP() {
        if (otpCodeEl.value !== otpState.code) {
            otpStatus.textContent = 'Invalid code. Please try again.';
            return;
        }
        if (Date.now() > otpState.expires) {
            otpStatus.textContent = 'Code expired. Please resend.';
            return;
        }

        // Success
        await submitWeb3Forms(otpState.email, otpState.source);
        closeModal('otp');
        openModal('success');
        localStorage.setItem('fracshr_waitlisted_verified', '1');
        $('#stickyCTA')?.classList.add('hidden');
    }
    
    $('#sendOtpBtn').addEventListener('click', () => sendOTP(false));
    $('#resendOtpBtn').addEventListener('click', () => sendOTP(false));
    $('#verifyOtpBtn').addEventListener('click', verifyOTP);
    otpCodeEl.addEventListener('keydown', e => e.key === 'Enter' && verifyOTP());

    async function submitWeb3Forms(email, source) {
        const payload = {
            access_key: CFG.web3forms.accessKey,
            subject: `New verified signup — ${CFG.brand}`,
            from_name: `${CFG.brand} Site`,
            email: email,
            message: `New verified signup:\nEmail: ${email}\nSource: ${source || 'Unknown'}\nTime: ${new Date().toISOString()}`,
        };
        try {
            await fetch(CFG.web3forms.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        } catch (e) { console.error("Web3Forms submission failed", e); }
    }

    /* DEMO GAME LOGIC */
    let demoState, guideTimer, pctx, rctx, chartObserver;
    const priceCanvas = $('#priceCanvas');
    const rsiCanvas = $('#rsiCanvas');

    function openDemo() { openModal('demo'); initDemo(); }
    function closeDemo() {
        closeModal('demo');
        if (guideTimer) clearInterval(guideTimer);
        // **FIX**: Disconnect observer to prevent memory leak
        if (chartObserver) chartObserver.disconnect();
        chartObserver = null;
    }

    function initDemo() {
        if (guideTimer) clearInterval(guideTimer);
        $('#levelComplete').classList.remove('active');
        demoState = {
            step: 0, marketPrice: 100.00, useLockedPrice: false, lockedPrice: null,
            cash: 10000.00, holdings: 0, avgPrice: 0, goal: 11000.00,
        };
        $('#qtyInput').value = 100; $('#qtyInput').disabled = true;
        $('#buyBtn').classList.add('btn-disabled'); $('#sellBtn').classList.add('btn-disabled');
        $('#nextBtn').classList.remove('hidden'); $('#nextBtn').classList.add('suggested');
        showCoach("Welcome! I’m your coach. Tap Next and I’ll walk you through a winning trade.");
        
        setupCanvases();
        generateInitialBars();
        drawAll();
        updateUI();
    }
    $('#resetDemo').addEventListener('click', initDemo);
    
    function setupCanvases() {
        const dpr = window.devicePixelRatio || 1;
        pctx = priceCanvas.getContext('2d');
        rctx = rsiCanvas.getContext('2d');
        
        if (chartObserver) chartObserver.disconnect();
        chartObserver = new ResizeObserver(debounce(() => {
            if (!priceCanvas.isConnected) return;
            [priceCanvas, rsiCanvas].forEach(canvas => {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
            });
            drawAll();
        }, 100));
        chartObserver.observe(priceCanvas.parentElement);
    }
    
    // All of the original chart drawing, bar generation, and game logic
    // can be pasted here without modification. It was functionally sound.
    // Starting from `function generateInitialBars() {`
    // to `function fillSummary() {`
    let bars=[]; const MAX_BARS=80;
    function generateInitialBars(){
      bars=[]; let last=100;
      for(let i=0;i<30;i++){
        const o=last; const delta=(Math.random()-.5)*0.5; const c=o+delta;
        const h=Math.max(o,c)+Math.random()*0.3; const l=Math.min(o,c)-Math.random()*0.3;
        bars.push({o,h,l,c}); last=c;
      }
      demoState.marketPrice = bars[bars.length-1].c;
    }
    function SMA(closes, period){
      const out=new Array(closes.length).fill(null); let sum=0;
      for(let i=0;i<closes.length;i++){
        sum+=closes[i]; if(i>=period) sum-=closes[i-period];
        if(i>=period-1) out[i]=sum/period;
      } return out;
    }
    function RSI(closes, period=14){
      const out=new Array(closes.length).fill(null); if (closes.length < period+1) return out;
      let gains=0, losses=0;
      for(let i=1;i<=period;i++){ const diff=closes[i]-closes[i-1]; if(diff>=0) gains+=diff; else losses+=-diff; }
      let avgGain=gains/period, avgLoss=losses/period;
      out[period]= 100 - (100/(1 + (avgGain/(avgLoss||1e-6))));
      for(let i=period+1;i<closes.length;i++){
        const diff=closes[i]-closes[i-1]; const gain= diff>0?diff:0; const loss= diff<0?-diff:0;
        avgGain = (avgGain*(period-1) + gain)/period; avgLoss = (avgLoss*(period-1) + loss)/period;
        const rs = avgGain/(avgLoss||1e-6); out[i]= 100 - (100/(1+rs));
      } return out;
    }
    function drawAll(){ drawPriceChart(); drawRSIChart(); }
    function drawPriceChart(){
      const ctx=pctx; const w=priceCanvas.clientWidth; const h=priceCanvas.clientHeight;
      ctx.clearRect(0,0,w,h); ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=1;
      for(let i=0;i<=5;i++){ ctx.beginPath(); ctx.moveTo(0,i*(h/5)); ctx.lineTo(w,i*(h/5)); ctx.stroke(); }
      const PADDING=10; const visible=bars.slice(-50); const highs=visible.map(b=>b.h), lows=visible.map(b=>b.l);
      const min=Math.min(...lows); const max=Math.max(...highs); const range=(max-min)||1;
      const cw=w - PADDING*2; const ch=h - PADDING*2; const bw = Math.max(2, cw/visible.length - 2);
      const closes=visible.map(b=>b.c); const sma10=SMA(closes,10), sma20=SMA(closes,20);
      function yFor(v){ return h - PADDING - ((v - min)/range)*ch; }
      visible.forEach((b, i)=>{
        const x = PADDING + i*(cw/visible.length) + 1;
        ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(x+bw/2, yFor(b.h)); ctx.lineTo(x+bw/2, yFor(b.l)); ctx.stroke();
        const up=b.c>=b.o; ctx.fillStyle = up ? getComputedStyle(document.documentElement).getPropertyValue('--up').trim() : getComputedStyle(document.documentElement).getPropertyValue('--down').trim();
        const top = yFor(up?b.c:b.o); const bottom = yFor(up?b.o:b.c);
        ctx.fillRect(x, top, bw, Math.max(1, bottom - top));
      });
      ctx.lineWidth=2;
      const drawLine = (data, color) => {
        ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue(color).trim(); ctx.beginPath();
        data.forEach((v,i)=>{ if(v==null) return; const x=PADDING + i*(cw/data.length) + bw/2; const y=yFor(v); (i===0||data[i-1]==null) ? ctx.moveTo(x,y) : ctx.lineTo(x,y);}); ctx.stroke();
      };
      drawLine(sma10, '--accent5'); drawLine(sma20, '--accent1');
    }
    function drawRSIChart(){
      const ctx=rctx; const w=rsiCanvas.clientWidth; const h=rsiCanvas.clientHeight;
      ctx.clearRect(0,0,w,h); const rsiArr=RSI(bars.map(b=>b.c).slice(-50),14);
      function yForRSI(v){ return h - (v/100)*h; }
      ctx.fillStyle='rgba(255,77,141,.08)'; ctx.fillRect(0, 0, w, yForRSI(70));
      ctx.fillStyle='rgba(32,227,178,.08)'; ctx.fillRect(0, yForRSI(30), w, h - yForRSI(30));
      ctx.strokeStyle='rgba(255,255,255,.25)'; [70,50,30].forEach(v=>{ ctx.beginPath(); ctx.moveTo(0, yForRSI(v)); ctx.lineTo(w, yForRSI(v)); ctx.stroke(); });
      ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent5').trim(); ctx.lineWidth=2; ctx.beginPath();
      rsiArr.forEach((v,i)=>{ if(v==null) return; const x = (i/(rsiArr.length-1)) * (w-10) + 5; const y = yForRSI(v); (i===0||rsiArr[i-1]==null) ? ctx.moveTo(x,y) : ctx.lineTo(x,y);}); ctx.stroke();
    }
    function addBar(nextClose){
      const last=bars[bars.length-1]||{c:100}; const o=last.c; const c=Number(nextClose.toFixed(2));
      const h=Math.max(o,c)+Math.random()*0.25; const l=Math.min(o,c)-Math.random()*0.25;
      bars.push({o,h,l,c}); if(bars.length>MAX_BARS) bars.shift();
      demoState.marketPrice=c;
    }
    function idleWobble(){ if(!guideTimer && modals.demo.classList.contains('active')) { addBar(bars[bars.length-1].c + (Math.random()-.5)*0.25); drawAll(); updateUI(); } }
    setInterval(idleWobble, 1200);
    const formatCurrency = (val) => (val < 0 ? '-' : '') + '$' + Math.abs(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    function updateUI(){
      const price = demoState.useLockedPrice ? demoState.lockedPrice : demoState.marketPrice;
      $('#priceLabel').textContent = formatCurrency(price).replace(/^-/, '');
      $('#priceNote').classList.toggle('hidden', !demoState.useLockedPrice);
      $('#cashLabel').textContent = formatCurrency(demoState.cash);
      $('#holdingsLabel').textContent = demoState.holdings;
      const portfolio = demoState.cash + demoState.holdings * price;
      $('#portfolioLabel').textContent = formatCurrency(portfolio);
      const unrealPNL = demoState.holdings > 0 ? (price - demoState.avgPrice) * demoState.holdings : 0;
      $('#pnlLabel').textContent = formatCurrency(unrealPNL);
      $('#pnlLabel').style.color = unrealPNL >= 0 ? 'var(--up)' : 'var(--down)';
    }
    function showCoach(msg) { $('#coachMsg').textContent = msg; }
    function clearHints(){ $$('.hint').forEach(h=>h.classList.remove('show')); $$('.suggested').forEach(b=>b.classList.remove('suggested'));}
    
    $('#nextBtn').addEventListener('click', () => {
        clearHints();
        switch(demoState.step) {
            case 0: // Start -> Buy
                demoState.step=1; $('#qtyInput').disabled=false;
                $('#buyBtn').classList.remove('btn-disabled'); $('#buyBtn').classList.add('suggested');
                showCoach("Step 1: The quantity is set. Tap BUY to open a position at exactly $100.00.");
                $('#nextBtn').classList.add('hidden'); $('#hintBuy').classList.add('show');
                break;
            case 2: // Buy -> Watch
                demoState.step=3; demoState.useLockedPrice=false;
                showCoach("Great! Now, watch the chart. I'll animate a price rise for you.");
                $('#nextBtn').classList.add('hidden'); startGuidedRise();
                break;
            case 4: // Watch -> Sell
                demoState.step=5;
                $('#sellBtn').classList.remove('btn-disabled'); $('#sellBtn').classList.add('suggested');
                showCoach("You're in profit! Tap SELL to lock it in and complete the level.");
                $('#nextBtn').classList.add('hidden'); $('#hintSell').classList.add('show');
                break;
        }
    });

    $('#buyBtn').addEventListener('click', () => {
        if($('#buyBtn').classList.contains('btn-disabled')) return;
        const buyPrice = 100.00; const qty = 100; const cost = qty * buyPrice;
        if(cost > demoState.cash) return;
        demoState.cash -= cost; demoState.holdings += qty; demoState.avgPrice = buyPrice;
        demoState.useLockedPrice = true; demoState.lockedPrice = buyPrice;
        updateUI(); drawAll();
        $('#buyBtn').classList.add('btn-disabled'); $('#qtyInput').disabled=true;
        demoState.step=2;
        showCoach("Position opened! Price is locked for clarity. Tap Next to see the market move.");
        $('#nextBtn').classList.remove('hidden'); $('#nextBtn').classList.add('suggested');
        clearHints(); $('#hintNext').classList.add('show');
    });

    function startGuidedRise(){
      const target=111.00; const steps=12;
      let tick=0;
      guideTimer=setInterval(()=>{
        const last=bars[bars.length-1].c;
        const move = (target - last) / Math.max(1, (steps - tick));
        addBar(last + move + (Math.random()*0.02));
        drawAll(); updateUI();
        tick++;
        if(tick>=steps || demoState.marketPrice >= target){
          clearInterval(guideTimer); guideTimer=null;
          demoState.step=4;
          showCoach("Target reached! You have a nice profit. Tap Next for the final step.");
          $('#nextBtn').classList.remove('hidden'); $('#nextBtn').classList.add('suggested');
          clearHints(); $('#hintNext').classList.add('show');
        }
      }, 700);
    }
    
    $('#sellBtn').addEventListener('click', () => {
        if($('#sellBtn').classList.contains('btn-disabled') || demoState.holdings <= 0) return;
        const sellPrice = demoState.marketPrice;
        demoState.cash += demoState.holdings * sellPrice;
        demoState.holdings = 0;
        updateUI();
        if(demoState.cash >= demoState.goal){
            setTimeout(()=> { fillSummary(); $('#levelComplete').classList.add('active'); }, 500);
        }
        $('#sellBtn').classList.add('btn-disabled'); clearHints();
    });

    function fillSummary(){
        const start = 10000; const final = demoState.cash;
        const profit = final - start; const roi = (profit / start) * 100;
        $('#sumStart').textContent = formatCurrency(start);
        $('#sumFinal').textContent = formatCurrency(final);
        $('#sumProfit').textContent = formatCurrency(profit);
        $('#sumROI').textContent = `${roi.toFixed(2)}%`;
        $('#sumEntry').textContent = `100 @ $100.00`;
        $('#sumExit').textContent = `100 @ ${demoState.marketPrice.toFixed(2)}`;
        $('#sumBeat').textContent = formatCurrency(final - demoState.goal);
    }
});