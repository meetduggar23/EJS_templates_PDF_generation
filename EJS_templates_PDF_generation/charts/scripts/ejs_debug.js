const fs=require('fs'); const ejs=require('ejs');
const txt=fs.readFileSync('views/chart.ejs','utf8');
const lines=txt.split('\n');
for(let i=1;i<=lines.length;i++){
  const part=lines.slice(0,i).join('\n');
  try{
    ejs.compile(part, {filename:'views/chart.ejs'});
  }catch(err){
    console.error('Error at line', i, err.message);
    process.exit(0);
  }
}
console.log('No error found');
