export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function directoryEntries(files,directory='') {
 const prefix=directory?directory+'/':'';const entries=new Map();
 for(const file of files){if(!file.path.startsWith(prefix))continue;const rest=file.path.slice(prefix.length),slash=rest.indexOf('/');if(!rest)continue;const name=slash<0?rest:rest.slice(0,slash);if(!entries.has(name))entries.set(name,{...file,path:prefix+name,name,directory:slash>=0});}
 return [...entries.values()].sort((a,b)=>Number(b.directory)-Number(a.directory)||(a.name<b.name?-1:a.name>b.name?1:0));
}
// Deliberately small Markdown subset. All source text is escaped; raw HTML is never executed.
export function renderReadme(text){
 const lines=text.replace(/\r\n/g,'\n').split('\n');let output='',code=null,paragraph=[];
 const flush=()=>{if(paragraph.length){output+='<p>'+escapeHtml(paragraph.join(' '))+'</p>';paragraph=[];}};
 for(const line of lines){if(/^```/.test(line)){flush();if(code===null)code=[];else{output+='<pre><code>'+escapeHtml(code.join('\n'))+'</code></pre>';code=null;}continue;}if(code!==null){code.push(line);continue;}
 const h=/^(#{1,6})\s+(.+)$/.exec(line);if(h){flush();output+=`<h${h[1].length}>${escapeHtml(h[2])}</h${h[1].length}>`;continue;}
 if(!line.trim()){flush();continue;}paragraph.push(line);
 }flush();if(code!==null)output+='<pre><code>'+escapeHtml(code.join('\n'))+'</code></pre>';return output;
}
