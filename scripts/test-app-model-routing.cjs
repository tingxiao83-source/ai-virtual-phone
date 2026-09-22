const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const modules = new Map();
function load(name) {
  if (name === 'api-log-store') return { pushApiLog() {} };
  if (modules.has(name)) return modules.get(name).exports;
  const mod = { exports: {} }; modules.set(name, mod);
  const source = fs.readFileSync(path.join('lib', name + '.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', 'require', js)(mod, mod.exports, p => load(p.replace(/^\.\//, '')));
  return mod.exports;
}
const { resolveAppModelConfig: route } = load('app-model-routing');
const { buildProviderRequest: build } = load('llm-provider-adapter');
const base = Object.freeze({ id: 'test', provider: 'Google', apiKey: 'dummy-test-only', defaultModel: 'gemini-2.5-pro', enableNativeTools: true, enableImageRecognition: true, enableImageGeneration: false });
const cases = { story: 'gemini-2.5-pro', chat: 'gemini-2.5-flash', group_chat: 'gemini-2.5-flash', shopping: 'gemini-2.5-flash-lite', shopping_search: 'gemini-2.5-flash-lite', xiaohongshu: 'gemini-2.5-flash-lite', checkphone: 'gemini-2.5-flash-lite', diary: 'gemini-2.5-flash-lite', calendar: 'gemini-2.5-flash-lite', qa: 'gemini-2.5-flash-lite', mascot: 'gemini-2.5-flash-lite', background: 'gemini-2.5-flash-lite' };
for (const [app, model] of Object.entries(cases)) {
  const config = route(base, app);
  assert.equal(config.defaultModel, model);
  assert.equal(config.apiKey, base.apiKey);
  assert.equal(config.enableNativeTools, true);
  assert.equal(route(config, app), config, 'correct configuration should be untouched');
}
assert.equal(route(base, 'story'), base);
assert.equal(route(base, 'api_test'), base);
assert.equal(route(base, 'embedding'), base);
for (const model of ['gemini-2.5-flash-image','gemini-2.5-pro-preview-tts','gemini-embedding-001','gemini-2.5-flash-native-audio-preview']) {
  const config = {...base, defaultModel: model}; assert.equal(route(config, 'story'), config);
}
const other = {...base, provider:'Anthropic', defaultModel:'claude-sonnet'};
assert.equal(route(other, 'chat'), other);
const existingPro = {...base, defaultModel:'gemini-3.1-pro-preview'};
assert.equal(route(existingPro, 'story'), existingPro);
const router = {...base, provider:'OpenRouter', defaultModel:'google/gemini-2.5-pro'};
assert.equal(route(router, 'shopping').defaultModel, 'google/gemini-2.5-flash-lite');

// Execute the real four dispatch functions up to actual provider payload creation.
// Throw at the network boundary: these tests make no paid requests.
const source=fs.readFileSync('lib/chat-engine.ts','utf8');
const sf=ts.createSourceFile('chat-engine.ts',source,ts.ScriptTarget.Latest,true);
const names=['sendLLMRequest','sendLLMStreamRequest','sendLLMToolRequest','sendLLMToolStreamRequest'];
const functions=sf.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(sf)).join('\n');
assert.equal(sf.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).length,4);
const js=ts.transpileModule(functions,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const dispatch={}; let captured;
const stop = new Error('stop before network');
new Function('exports','resolveAppModelConfig','applyChatPluginLlmRequest','toLlmRequestMessages','buildProviderRequest',js)(dispatch,route,async(p,m)=>({preset:p,messages:m}),m=>m,(...args)=>{captured=build(...args);throw stop;});
(async()=>{
 for(const name of names) for(const [app,model] of Object.entries(cases)) {
  const messages=[{role:'user',content:'test'}]; const options={appId:app};
  const args=name.includes('Tool') ? [base,null,messages,[{name:'test_tool',description:'test',parameters:{type:'object',properties:{}}}],[],{},options] : [base,null,messages,[],{},options];
  await assert.rejects(dispatch[name](...args), e=>e===stop);
  assert.ok(captured.url.includes('/models/'+model+':'), `${name}/${app}: wrong model in actual URL`);
 }
 const originalFetch=global.fetch, originalLog=console.log;
 try {
  console.log=()=>{};
  global.fetch=async(url)=>{captured=String(url);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'ok'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  await load('api-helpers').simpleLLMCall(base,[{role:'user',content:'test'}]);
  assert.ok(captured.includes('/models/gemini-2.5-flash-lite:'));
  await load('api-helpers').simpleLLMCall(base,[{role:'user',content:'test'}],{appId:'api_test'});
  assert.ok(captured.includes('/models/gemini-2.5-pro:'));
 } finally {global.fetch=originalFetch;console.log=originalLog;}
 console.log('Passed: 48 real dispatch/payload cases; tier preservation, gateway namespaces, dedicated models, auxiliary calls and API-test isolation. No network requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
