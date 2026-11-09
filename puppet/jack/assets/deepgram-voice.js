/* Optional Jack-only Deepgram audition. No API key reaches the browser. */
(function(){
  let failures=0,pauseUntil=0;
  window.JackDeepgram={async say(text,speaker,gesture,unlock,getContext,isOn){
    if(Date.now()<pauseUntil)return false;
    const clean=window.JackCore.stripTags(text).trim().slice(0,600);
    if(!clean)return false;
    let source,analyser,done=false;
    try{
      unlock();const ctx=getContext();if(ctx&&ctx.state!=="running"){try{await ctx.resume();}catch(e){}}if(!ctx||ctx.state!=="running")throw Error("audio_locked");
      const r=await fetch("speech.php",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:clean,csrf:window.PUPPET_CONFIG.brain.csrf}),signal:AbortSignal.timeout(25000)});
      if(!r.ok)throw Error("speech_unavailable");
      const bytes=await r.arrayBuffer(),buffer=await ctx.decodeAudioData(bytes);failures=0;
      if(!isOn())return true;
      source=ctx.createBufferSource();source.buffer=buffer;
      analyser=ctx.createAnalyser();analyser.fftSize=512;
      const gain=ctx.createGain();source.connect(analyser);analyser.connect(gain);gain.connect(ctx.destination);
      const ended=new Promise(resolve=>{source.onended=()=>{done=true;resolve();};});
      const data=new Uint8Array(analyser.fftSize);
      function tick(){if(done)return;analyser.getByteTimeDomainData(data);let sum=0;for(const x of data)sum+=((x-128)/128)**2;
        // Drive the same face from actual sound, and honor sound-off immediately.
        gain.gain.value=isOn()?1:0;
        if(window.JackDeepgram.onLevel)window.JackDeepgram.onLevel(Math.min(1,Math.sqrt(sum/data.length)*4));
        requestAnimationFrame(tick);}
      source.start();tick();
      window.JackDeepgram.last={provider:"Deepgram",voice:"aura-2-draco-en",duration:buffer.duration};
      await speaker.say(text,{cps:13.5,until:ended,onGesture:gesture});
      gain.disconnect();return true;
    }catch(e){if(e.message!=="audio_locked"){failures++;pauseUntil=Date.now()+Math.min(300000,15000*2**(failures-1));}window.JackDeepgram.last={provider:"device fallback",reason:e.message};console.warn("Jack Deepgram test unavailable; using device voice.");return false;}
    finally{done=true;if(source)source.disconnect();if(analyser)analyser.disconnect();}
  }};
})();
