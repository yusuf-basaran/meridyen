export function archiveMonths(articles,fileLimit){
  const months=new Map();
  for(const article of articles){const month=article.published_at.slice(0,7);if(!months.has(month))months.set(month,[]);months.get(month).push(article);}
  let kept=0;let archiving=false;const archived=[];
  for(const [month,group] of [...months].sort(([a],[b])=>b.localeCompare(a))){
    if(!archiving&&kept+group.length<=fileLimit)kept+=group.length;
    else{archiving=true;const path=`/arsiv/${month.replace('-','/')}/`;for(const article of group)article.archivePath=path;archived.push([month,group,path]);}
  }
  return archived;
}
