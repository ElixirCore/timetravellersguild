/* Keep the current dock item in view on load. */
(function(){
  var d=document.getElementById('dock');
  if(!d||d.scrollWidth<=d.clientWidth)return;
  var c=d.querySelector('[aria-current="page"]');
  if(!c)return;
  var l=c.offsetLeft,r=l+c.offsetWidth;
  if(r>d.scrollLeft+d.clientWidth)d.scrollLeft=r-d.clientWidth+16;
  else if(l<d.scrollLeft)d.scrollLeft=l-16;
})();
