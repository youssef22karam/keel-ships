window.keelReady=false;
window.keelWatchdog=setTimeout(function(){if(window.keelReady)return;document.getElementById('loading-title').textContent='THE ENGINE NEEDS A CONNECTION';document.getElementById('loading-detail').textContent='Check your internet connection and enable WebGL 2 / hardware acceleration, then reload the shipyard.';document.getElementById('loading-line').hidden=true;document.getElementById('retry-button').hidden=false;},25000);
document.getElementById('retry-button').addEventListener('click',function(){location.reload();});
