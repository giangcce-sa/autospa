export const guideJs = `
(function(){
  'use strict';
  var base=window.location.origin;
  var models=[];
  var activeKind='all';
  var clientNames={'claude-code':'Claude Code','cursor':'Cursor','n8n':'n8n','ai-spa':'AI Spa'};
  var clientNotes={'claude-code':'Dùng endpoint Anthropic-compatible qua biến môi trường.','cursor':'Thêm custom OpenAI provider trong Cursor.','n8n':'Dùng HTTP Request node với Bearer token.','ai-spa':'Cấu hình gateway tập trung cho chat, image và vision.'};
  document.getElementById('openai-base').textContent=base+'/v1';
  document.getElementById('anthropic-base').textContent=base;
  document.getElementById('curl-code').textContent='curl '+base+'/v1/chat/completions \\\\\\n  -H "Authorization: Bearer gw_live_YOUR_KEY" \\\\\\n  -H "Content-Type: application/json" \\\\\\n  -d \\'{"model":"auto","messages":[{"role":"user","content":"Hello"}]}\\'';
  function esc(v){return String(v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function copyText(text,button){navigator.clipboard.writeText(text).then(function(){var old=button.textContent;button.textContent='Đã copy';setTimeout(function(){button.textContent=old},1200)})}
  document.addEventListener('click',function(e){var button=e.target.closest('[data-copy]');if(!button)return;var target=document.querySelector(button.getAttribute('data-copy'));if(target)copyText(target.textContent,button)});
  function renderModels(){
    var list=document.getElementById('model-list');
    var filtered=activeKind==='all'?models:models.filter(function(m){return m.kind===activeKind||m.task_types.indexOf(activeKind)>=0});
    if(!filtered.length){list.innerHTML='<p>Không có model trong nhóm này.</p>';return}
    list.innerHTML=filtered.map(function(m){return '<div class="model-row"><code title="'+esc(m.id)+'">'+esc(m.id)+'</code><button data-model="'+esc(m.id)+'">Copy</button></div>'}).join('');
  }
  fetch('/guide/data').then(function(r){if(!r.ok)throw Error();return r.json()}).then(function(payload){
    models=payload.data.models;
    document.getElementById('model-count').textContent=models.length+' model đang bật';
    var kinds=['all'].concat(Array.from(new Set(models.map(function(m){return m.kind}).concat(models.flatMap(function(m){return m.task_types}))))).filter(function(v){return ['all','chat','coding','image','image-generation','vision','audio','speech-to-text','text-to-speech'].indexOf(v)>=0});
    document.getElementById('model-tabs').innerHTML=kinds.map(function(k,i){return '<button class="'+(i===0?'active':'')+'" data-kind="'+esc(k)+'">'+esc(k==='all'?'Tất cả':k)+'</button>'}).join('');
    renderModels();
  }).catch(function(){document.getElementById('model-count').textContent='Registry không khả dụng';document.getElementById('model-list').innerHTML='<p>Không tải được model. Thử lại sau.</p>'});
  document.getElementById('model-tabs').addEventListener('click',function(e){var b=e.target.closest('[data-kind]');if(!b)return;activeKind=b.dataset.kind;this.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});renderModels()});
  document.getElementById('model-list').addEventListener('click',function(e){var b=e.target.closest('[data-model]');if(b)copyText(b.dataset.model,b)});
  function renderClient(client){
    document.getElementById('client-title').textContent=clientNames[client];
    document.getElementById('client-note').textContent=clientNotes[client];
    document.getElementById('client-steps').innerHTML='<li>Tạo hoặc lấy API key từ Admin.</li><li>Copy cấu hình bên phải.</li><li>Khởi động lại client và chọn model <code>auto</code>.</li>';
    document.getElementById('client-code').textContent='Đang tải cấu hình…';
    fetch('/client-config/'+client).then(function(r){return r.json()}).then(function(p){
      var d=p.data, text='';
      if(client==='claude-code') text=JSON.stringify({env:d.env},null,2);
      if(client==='cursor') text=JSON.stringify(d.openAiProvider,null,2);
      if(client==='n8n') text=JSON.stringify(d.httpRequest,null,2);
      if(client==='ai-spa') text=JSON.stringify({baseUrl:d.baseUrl,apiKey:'<gateway-api-key>',model:d.defaultModel,endpoints:d.endpoints},null,2);
      document.getElementById('client-code').textContent=text;
    }).catch(function(){document.getElementById('client-code').textContent='Không tải được cấu hình.'});
  }
  document.getElementById('client-tabs').addEventListener('click',function(e){var b=e.target.closest('[data-client]');if(!b)return;this.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});renderClient(b.dataset.client)});
  renderClient('claude-code');
})();`;

export const checkJs = `
(function(){
  'use strict';
  var form=document.getElementById('check-form'),input=document.getElementById('api-key'),button=document.getElementById('check-button'),result=document.getElementById('check-result'),toggle=document.getElementById('toggle-key');
  toggle.addEventListener('click',function(){var show=input.type==='password';input.type=show?'text':'password';toggle.textContent=show?'Ẩn':'Hiện';toggle.setAttribute('aria-label',show?'Ẩn API key':'Hiện API key')});
  function fmt(n){return new Intl.NumberFormat('vi-VN').format(Number(n||0))}
  function item(label,value,extra,wide){return '<div class="result-item '+(wide?'result-wide':'')+'"><span class="result-label">'+label+'</span><strong>'+value+'</strong>'+(extra||'')+'</div>'}
  form.addEventListener('submit',function(e){
    e.preventDefault();var key=input.value.trim();if(!key)return;
    button.disabled=true;button.textContent='Đang kiểm tra…';result.hidden=true;result.className='result';
    fetch('/check/api-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({api_key:key})})
      .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error&&d.error.message||'Không thể kiểm tra key');return d})})
      .then(function(p){var d=p.data,q=d.quota,u=d.usage,tokenTotal=u.input_tokens+u.output_tokens;var pct=q.monthly_token_limit?Math.min(100,Math.round(tokenTotal/q.monthly_token_limit*100)):0;
        result.innerHTML='<div class="result-head"><div><span class="result-label">API key</span><strong>'+d.key_prefix+'… · '+d.key_name+'</strong></div><span class="status ok">ACTIVE</span></div><div class="result-grid">'+
          item('Client',d.client_name)+item('Requests tháng này',fmt(u.request_count))+item('Tokens tháng này',fmt(tokenTotal))+
          item('Rate limit',fmt(q.rate_limit_per_minute)+' / phút')+item('Daily request limit',q.daily_request_limit==null?'Không giới hạn':fmt(q.daily_request_limit))+item('Hết hạn',d.expires_at?new Date(d.expires_at).toLocaleDateString('vi-VN'):'Không đặt')+
          item('Monthly token quota',q.monthly_token_limit==null?'Không giới hạn':fmt(q.monthly_token_limit-tokenTotal)+' còn lại','<div class="meter"><span style="width:'+pct+'%"></span></div>',true)+
          item('Model được phép',d.policy.allowed_models.length?d.policy.allowed_models.join(', '):'Theo routing registry','',true)+'</div>';
        result.hidden=false;
      }).catch(function(err){result.className='result error';result.innerHTML='<strong>Không kiểm tra được API key</strong><p>'+err.message+'</p>';result.hidden=false})
      .finally(function(){button.disabled=false;button.textContent='Kiểm tra key'});
  });
})();`;
