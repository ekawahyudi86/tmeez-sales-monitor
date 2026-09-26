
        async function restoreSession(){
            const raw=localStorage.getItem(SESSIONKEY);
            if(!raw) return false;
            try{
                const saved=JSON.parse(raw);
                if(!saved.token || !saved.user) throw new Error('Session kosong');
                sessionToken=saved.token;
                currentUser=saved.user;

                // Server-side validation: token, expiry, account status, role.
                const me=await apiGet('me');
                const serverUser=me.user||{};
                currentUser.username=serverUser.username||currentUser.username;
                currentUser.role=String(serverUser.role||currentUser.role).toLowerCase()==='sales'?'sales':'admin';
                currentUser.salesId=serverUser.salesId||currentUser.salesId||'';

                document.getElementById('login-screen').classList.add('hidden');
                switchRole(currentUser.role==='sales'?'sales':'admin');
                document.getElementById('current-user-name').innerText=currentUser.name||currentUser.username||'Pengguna';
                await refreshOnlineData(false);
                renderMaster();renderDynamicForms();refreshVisitKpi();
                return true;
            }catch(err){
                clearSession();
                currentUser=null;
                document.getElementById('login-screen').classList.remove('hidden');
                return false;
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            lucide.createIcons();
            calculateInvoiceTotal();
            loadDb();
            await restoreSession();
        });

        // Role Switcher Simulation
        function switchRole(role) {
            const salesView = document.getElementById('view-sales');
            const adminView = document.getElementById('view-admin');
            const btnSales = document.getElementById('btn-sales');
            const btnAdmin = document.getElementById('btn-admin');
            const roleSwitcher = document.getElementById('role-switcher');
            const userName = document.getElementById('current-user-name');
            const userRole = document.getElementById('current-user-role');

            // Security UI: Sales tidak pernah boleh membuka Dashboard Admin.
            if (currentUser?.role === 'sales' && role === 'admin') role = 'sales';

            if (currentUser?.role === 'sales') {
                document.getElementById('change-password-btn')?.classList.add('hidden');
                if (roleSwitcher) roleSwitcher.classList.add('hidden');
            } else {
                document.getElementById('change-password-btn')?.classList.remove('hidden');
                if (roleSwitcher) roleSwitcher.classList.remove('hidden');
            }

            if (role === 'sales') {
                salesView.classList.remove('hidden');
                adminView.classList.add('hidden');
                if(btnSales) btnSales.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 bg-brand-600 text-white shadow";
                if(btnAdmin) btnAdmin.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-300 hover:text-white";
                userName.innerText = currentUser?.name || "Sales";
                userRole.innerText = currentUser?.role==='sales' ? "Sales Lapangan" : "Tampilan Sales";
            } else {
                salesView.classList.add('hidden');
                adminView.classList.remove('hidden');
                if(btnAdmin) btnAdmin.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 bg-brand-600 text-white shadow";
                if(btnSales) btnSales.className = "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-300 hover:text-white";
                userName.innerText = currentUser?.name || "Administrator";
                userRole.innerText = "Admin / Supervisor";
            }
        }

        function switchKpiPeriod(period) {
            ['daily','weekly','monthly'].forEach(p=>document.getElementById(`kpi-btn-${p}`).className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition");
            document.getElementById(`kpi-btn-${period}`).className="px-3 py-1.5 rounded-lg bg-white text-slate-800 shadow-sm transition";
            renderSalesProgress(period);
        }

        // Admin Filter Switcher Simulation
        let currentAdminPeriod='monthly';
        function switchAdminFilter(filter){
          currentAdminPeriod=filter;
          ['daily','weekly','monthly'].forEach(f=>{const b=document.getElementById(`admin-filter-${f}`);if(b)b.className='px-3 py-1.5 rounded-lg '+(f===filter?'bg-white text-slate-800 shadow-sm':'text-slate-600 hover:text-slate-900')+' transition';});
          renderAdminDashboard(filter);
        }

        const API_URL='https://script.google.com/macros/s/AKfycbyR-riwS3HVUM93sA8D09AR3Orb1kgYbZnZ9HwKSYA8Z1wo0DaJh-Z-sqQhSQvJ53ANCg/exec';
        const DBKEY='tmeez_sales_monitor_v6_4_3_cache';
        const SESSIONKEY='tmeez_sales_monitor_v6_4_3_session';
        let apiOnline=false;
        let sessionToken='';
        async function apiGet(action,params={}){
          const q=new URLSearchParams({action,...params});
          if(sessionToken)q.set('token',sessionToken);
          const r=await fetch(API_URL+'?'+q.toString(),{cache:'no-store'});
          if(!r.ok)throw new Error('HTTP '+r.status);
          const j=await r.json();if(!j.success)throw new Error(j.message||'API gagal');return j;
        }
        async function apiPost(payload){
          const body={...payload};
          if(sessionToken && body.action!=='login') body.token=sessionToken;
          const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});
          if(!r.ok) throw new Error('HTTP '+r.status);
          const j=await r.json();
          if(!j.success) throw new Error(j.message||'API gagal');
          return j;
        }
        function saveSession(){
          if(currentUser&&sessionToken)localStorage.setItem(SESSIONKEY,JSON.stringify({token:sessionToken,user:currentUser}));
        }
        function clearSession(){sessionToken='';localStorage.removeItem(SESSIONKEY);}
        function mapSales(x){return {id:String(x.SalesID||''),name:String(x.Name||''),phone:String(x.Phone||''),area:String(x.Area||''),targetVisit:+x.TargetVisit||0,targetBox:+x.TargetBox||0,active:String(x.Status||'Active').toLowerCase()==='active'};}
        function mapStore(x){return {id:String(x.StoreID||''),name:String(x.StoreName||''),owner:String(x.OwnerName||''),wa:String(x.WhatsApp||''),address:String(x.Address||''),lat:+x.Latitude||0,lng:+x.Longitude||0,accuracy:+x.GPSAccuracy||0,photoFileId:String(x.PhotoFileID||''),photoUrl:String(x.PhotoURL||''),createdBySalesId:String(x.CreatedBySalesID||''),createdByName:String(x.CreatedByName||''),createdAt:x.CreatedAt?String(x.CreatedAt):'',status:String(x.Status||'Active'),source:String(x.CreatedBySalesID||'')==='ADMIN'?'admin':'sales'};}
        function mapVisit(x){return {id:String(x.VisitID||''),storeId:String(x.StoreID||''),store:String(x.StoreName||''),salesId:String(x.SalesID||''),salesName:String(x.SalesName||''),date:String(x.CheckInAt||'').slice(0,10),checkIn:String(x.CheckInAt||''),checkOut:String(x.CheckOutAt||''),lat:+x.CheckInLat||0,lng:+x.CheckInLng||0,accuracy:+x.GPSAccuracy||0,distance:+x.DistanceMeter||0,duration:+x.DurationMinute||0,result:String(x.Result||''),reason:String(x.Notes||'')};}
        function mapOrderPack(x){const o=x.order||{},items=x.items||[];return {id:String(o.OrderID||''),salesId:String(o.SalesID||''),storeId:String(o.StoreID||''),date:String(o.OrderDate||o.CreatedAt||''),qty:+o.TotalQtyPcs||items.reduce((n,z)=>n+(+z.QtyPcs||0),0),subtotal:+o.Subtotal||0,discount:+o.Discount||0,total:+o.GrandTotal||0,items};}
        function mapProduct(x){return {id:String(x.ProductID||''),name:String(x.ProductName||''),price:+(x.PricePerPcs!==''&&x.PricePerPcs!==undefined?x.PricePerPcs:x.PricePerBox)||0,pack:+x.UnitsPerBox||10,sku:String(x.SKU||''),status:String(x.Status||'Active')};}
        async function refreshOnlineData(showMessage=false){
          try{
            let st,pr;
            if(currentUser?.role==='admin'){
              const [sa,xst,xpr,xvi,xor,xset]=await Promise.all([apiGet('sales'),apiGet('stores'),apiGet('products'),apiGet('visits',{limit:500}),apiGet('orders',{limit:200}),apiGet('settings')]);
              db.sales=(sa.data||[]).map(mapSales);db.visits=(xvi.data||[]).map(mapVisit);db.orders=(xor.data||[]).map(mapOrderPack);applyOnlineSettings(xset.data||[]);st=xst;pr=xpr;
            }else{
              const [xst,xpr,xvi,xor,xset]=await Promise.all([apiGet('stores'),apiGet('products'),apiGet('visits',{limit:200}),apiGet('orders',{limit:200}),apiGet('settings')]);
              st=xst;pr=xpr;db.visits=(xvi.data||[]).map(mapVisit);db.orders=(xor.data||[]).map(mapOrderPack);applyOnlineSettings(xset.data||[]);
            }
            db.stores=(st.data||[]).map(mapStore);
            if(currentUser?.role==='sales')db.stores=db.stores.filter(x=>String(x.createdBySalesId)===String(currentUser.salesId)&&String(x.status).toLowerCase()==='active');
            db.products=(pr.data||[]).map(mapProduct);apiOnline=true;saveDb();renderMaster();renderDynamicForms();refreshVisitKpi();renderAdminDashboard(currentAdminPeriod||'monthly');
            if(showMessage)showToast('Data Google Sheet berhasil disinkronkan');
          }catch(err){apiOnline=false;if(showMessage)showToast('Sinkronisasi gagal: '+err.message);}
        }

        let db={users:[],sales:[],stores:[],products:[],visits:[],orders:[],settings:{radius:100}};
        let currentUser=null;
        function loadDb(){
          const raw=localStorage.getItem(DBKEY);
          if(raw){ try{db=JSON.parse(raw)}catch(e){} }
          db.users=db.users||[]; db.products=db.products||[]; db.sales=db.sales||[]; db.stores=db.stores||[]; db.visits=db.visits||[]; db.orders=db.orders||[]; db.settings=db.settings||{radius:100};
          renderMaster(); renderDynamicForms(); refreshVisitKpi(); refreshOnlineData(false);
        }
        function saveDb(){localStorage.setItem(DBKEY,JSON.stringify(db));}
        window.addEventListener('storage',e=>{if(e.key===DBKEY && e.newValue){try{db=JSON.parse(e.newValue);renderMaster();renderDynamicForms();refreshVisitKpi();}catch(err){}}});
        async function loginApp(e){
          e.preventDefault(); clearSession(); const u=document.getElementById('login-user').value.trim(),p=document.getElementById('login-pass').value;
          try{
            const res=await apiPost({action:'login',username:u,password:p}); sessionToken=res.token||''; const x=res.user||{}; const role=String(x.role||'').toLowerCase();
            currentUser={username:x.username||u,role:role==='sales'?'sales':'admin',name:x.sales?.Name||x.username||'Administrator',salesId:x.salesId||'',active:true}; saveSession();
            if(currentUser.salesId && x.sales){const mapped=mapSales(x.sales); if(!db.sales.some(s=>s.id===mapped.id))db.sales.push(mapped);}
            document.getElementById('login-screen').classList.add('hidden'); switchRole(currentUser.role==='sales'?'sales':'admin');
            document.getElementById('current-user-name').innerText=currentUser.name; document.getElementById('current-user-role').innerText=currentUser.role==='sales'?'Sales · '+(db.sales.find(s=>s.id===currentUser.salesId)?.area||''):String(x.role||'Admin').toUpperCase();
            await refreshOnlineData(false); renderMaster();renderDynamicForms();refreshVisitKpi(); showToast('Login online berhasil');
          }catch(err){showToast('Login gagal: '+err.message);}
        }
        function uid(prefix){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
        async function addSales(e){
          e.preventDefault(); const username=document.getElementById('m-sales-user').value.trim();
          try{await apiPost({action:'addSales',name:document.getElementById('m-sales-name').value.trim(),phone:document.getElementById('m-sales-phone').value.trim(),area:document.getElementById('m-sales-area').value.trim(),username,password:document.getElementById('m-sales-pass').value,targetVisit:+document.getElementById('m-sales-visit').value||0,targetBox:+document.getElementById('m-sales-box').value||0});
            db.users.push({username,role:'sales'}); e.target.reset();document.getElementById('m-sales-visit').value=0;document.getElementById('m-sales-box').value=0;await refreshOnlineData(false);showToast('Sales tersimpan ke Google Sheet');
          }catch(err){showToast('Gagal menambah sales: '+err.message);}
        }
        async function addStoreMaster(e){
          e.preventDefault(); try{await apiPost({action:'addStore',storeName:document.getElementById('m-store-name').value.trim(),ownerName:document.getElementById('m-store-owner').value.trim(),latitude:+document.getElementById('m-store-lat').value,longitude:+document.getElementById('m-store-lng').value,salesId:document.getElementById('m-store-sales')?.value||''});e.target.reset();await refreshOnlineData(false);showToast('Toko tersimpan ke Google Sheet');}catch(err){showToast('Gagal menambah toko: '+err.message);}
        }
        async function addProduct(e){
          e.preventDefault();try{await apiPost({action:'addProduct',productName:document.getElementById('m-product-name').value.trim(),pricePerPcs:+document.getElementById('m-product-price').value||0,unitsPerBox:+document.getElementById('m-product-pack').value||10,unit:'PCS'});e.target.reset();await refreshOnlineData(false);showToast('Produk tersimpan ke Google Sheet');}catch(err){showToast('Gagal menambah produk: '+err.message);}
        }
        function renderMaster(){
          const tl=document.getElementById('store-list'),pl=document.getElementById('product-list');
          renderSalesManagement();
          if(tl) tl.innerHTML=db.stores.map(x=>`<div class="flex justify-between gap-2 bg-slate-50 p-2 rounded-xl text-[11px]"><span class="min-w-0"><b>${escapeHtml(x.name||'')}</b> <span class="${x.status==='Inactive'?'text-red-500':'text-emerald-600'}">${x.status==='Inactive'?'● Nonaktif':'● Aktif'}</span><br><span class="text-slate-500">${escapeHtml(x.address||x.owner||'')}</span><br><span class="text-brand-700">${escapeHtml(x.createdByName||'Belum ada Sales')}</span></span><button class="shrink-0 px-2 py-1 border rounded-lg bg-white font-semibold" onclick="openStoreModal('${x.id}')">Edit</button></div>`).join('')||'<p class="text-[11px] text-slate-400">Belum ada toko.</p>';
          if(pl) pl.innerHTML=db.products.map(x=>`<div class="flex justify-between gap-2 bg-slate-50 p-2 rounded-xl text-[11px]"><span><b>${escapeHtml(x.name)}</b><br>${rupiah(x.price)}/PCS · ${x.pack} PCS/dus</span><button class="px-2 py-1 border rounded-lg bg-white font-semibold" onclick="openProductModal('${x.id}')">Edit</button></div>`).join('')||'<p class="text-[11px] text-slate-400">Belum ada produk.</p>';
        }
        function renderSalesManagement(){
          const sl=document.getElementById('sales-list'); if(!sl)return; const q=(document.getElementById('sales-search')?.value||'').toLowerCase();
          const rows=db.sales.filter(x=>{const u=db.users.find(z=>z.salesId===x.id);return [x.name,x.area,x.phone,u?.username].join(' ').toLowerCase().includes(q)});
          sl.innerHTML=rows.map(x=>{const u=db.users.find(z=>z.salesId===x.id); const visits=db.visits.filter(v=>v.salesId===x.id); const orders=visits.filter(v=>v.result==='order').length; const strike=visits.length?Math.round(orders/visits.length*100):0; const registered=db.stores.filter(t=>t.createdBySalesId===x.id || (u && t.createdByUsername===u.username)).length; return `<div class="border rounded-xl p-4 bg-slate-50/60"><div class="flex justify-between gap-3"><div><p class="font-bold text-sm">${escapeHtml(x.name)}</p><p class="text-[11px] text-slate-500">${escapeHtml(x.area||'-')} · @${escapeHtml(u?.username||'-')}</p><p class="text-[11px] mt-1 ${x.active!==false?'text-emerald-600':'text-red-600'}">${x.active!==false?'● Akun aktif':'● Akun nonaktif'}</p></div><div class="text-right text-[11px]"><b>${visits.length}</b> visit<br><b>${registered}</b> toko baru<br><b>${strike}%</b> strike</div></div><div class="grid grid-cols-2 gap-2 mt-3 text-[11px]"><div class="bg-white rounded-lg p-2">Target Visit<br><b>${x.targetVisit||0}</b>/bulan</div><div class="bg-white rounded-lg p-2">Target PCS<br><b>${x.targetBox||0}</b>/bulan</div></div><button onclick="openSalesModal('${x.id}')" class="mt-3 w-full bg-slate-900 text-white rounded-lg py-2 text-xs font-semibold">Detail / Edit Sales</button></div>`}).join('')||'<div class="md:col-span-2 xl:col-span-3 py-8 text-center text-sm text-slate-400">Belum ada sales. Tambahkan sales melalui form di atas.</div>';
        }
        function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
        function openSalesModal(id){
          const s=db.sales.find(x=>x.id===id),u=db.users.find(x=>x.salesId===id); if(!s)return;
          document.getElementById('edit-sales-id').value=id; document.getElementById('edit-sales-name').value=s.name||''; document.getElementById('edit-sales-phone').value=s.phone||''; document.getElementById('edit-sales-area').value=s.area||''; document.getElementById('edit-sales-user').value=u?.username||''; document.getElementById('edit-sales-visit').value=s.targetVisit||0; document.getElementById('edit-sales-box').value=s.targetBox||0; document.getElementById('edit-sales-subtitle').innerText=(s.area||'Tanpa area')+' · '+(s.active!==false?'Akun aktif':'Akun nonaktif');
          const visits=db.visits.filter(v=>v.salesId===id).sort((a,b)=>(b.checkIn||'').localeCompare(a.checkIn||''));
          const registeredStores=db.stores.filter(t=>t.createdBySalesId===id || (u && t.createdByUsername===u.username)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
          const orders=visits.filter(v=>v.result==='order').length;
          document.getElementById('edit-kpi-visit').innerText=visits.length; document.getElementById('edit-kpi-order').innerText=orders; document.getElementById('edit-kpi-strike').innerText=(visits.length?Math.round(orders/visits.length*100):0)+'%'; document.getElementById('edit-kpi-stores').innerText=registeredStores.length;
          document.getElementById('edit-toggle-btn').innerText=s.active!==false?'Nonaktifkan Akun':'Aktifkan Akun';
          document.getElementById('edit-sales-stores').innerHTML=registeredStores.map(t=>`<div class="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2 text-xs"><b>${escapeHtml(t.name||'-')}</b><br><span class="text-slate-500">${escapeHtml(t.address||t.owner||'-')}</span><br><span class="text-[11px] text-indigo-700">${t.createdAt?new Date(t.createdAt).toLocaleString('id-ID'):'-'}</span></div>`).join('')||'<p class="text-xs text-slate-400 py-3">Belum ada toko yang didaftarkan sales ini.</p>';
          document.getElementById('edit-sales-visits').innerHTML=visits.slice(0,10).map(v=>`<div class="bg-slate-50 rounded-lg p-2 text-xs flex justify-between gap-3"><span><b>${escapeHtml(v.store||'-')}</b><br><span class="text-slate-500">${escapeHtml(v.date||'')} · ${escapeHtml(v.result||'-')}</span></span><span class="text-right">${v.duration||0} mnt<br>${Math.round(v.distance||0)} m</span></div>`).join('')||'<p class="text-xs text-slate-400 py-3">Belum ada riwayat kunjungan.</p>';
          const ts=document.getElementById('transfer-sales-target');if(ts)ts.innerHTML='<option value="">Pilih Sales pengganti</option>'+db.sales.filter(z=>z.id!==id&&z.active!==false).map(z=>`<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('');
          document.getElementById('sales-modal').classList.remove('hidden');
        }
        function closeSalesModal(){document.getElementById('sales-modal').classList.add('hidden');}
                function closeModal(id){document.getElementById(id)?.classList.add('hidden');}
        function logoutApp(){clearSession();currentUser=null;location.reload();}
        function openPasswordModal(){document.getElementById('password-modal').classList.remove('hidden');}
        async function changeMyPassword(e){e.preventDefault();const a=document.getElementById('new-password').value,b=document.getElementById('confirm-password').value;if(a!==b){showToast('Konfirmasi password tidak sama');return;}try{await apiPost({action:'changeMyPassword',oldPassword:document.getElementById('old-password').value,newPassword:a});clearSession();showToast('Password berubah. Silakan login kembali.');setTimeout(()=>location.reload(),900);}catch(err){showToast(err.message);}}
        function openStoreModal(id){const x=db.stores.find(s=>s.id===id);if(!x)return;document.getElementById('edit-store-id').value=x.id;document.getElementById('edit-store-name').value=x.name;document.getElementById('edit-store-owner').value=x.owner;document.getElementById('edit-store-wa').value=x.wa;document.getElementById('edit-store-address').value=x.address;document.getElementById('edit-store-lat').value=x.lat;document.getElementById('edit-store-lng').value=x.lng;const sel=document.getElementById('edit-store-sales');sel.innerHTML='<option value="">Pilih Sales</option>'+db.sales.filter(s=>s.active!==false||s.id===x.createdBySalesId).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');sel.value=x.createdBySalesId;document.getElementById('edit-store-status').value=x.status||'Active';document.getElementById('store-modal').classList.remove('hidden');}
        async function saveStoreEdit(e){e.preventDefault();try{await apiPost({action:'updateStore',storeId:document.getElementById('edit-store-id').value,storeName:document.getElementById('edit-store-name').value,ownerName:document.getElementById('edit-store-owner').value,whatsapp:document.getElementById('edit-store-wa').value,address:document.getElementById('edit-store-address').value,latitude:+document.getElementById('edit-store-lat').value,longitude:+document.getElementById('edit-store-lng').value,salesId:document.getElementById('edit-store-sales').value,status:document.getElementById('edit-store-status').value});closeModal('store-modal');await refreshOnlineData();showToast('Toko diperbarui');}catch(err){showToast(err.message);}}
        function openProductModal(id){const x=db.products.find(p=>p.id===id);if(!x)return;document.getElementById('edit-product-id').value=x.id;document.getElementById('edit-product-name').value=x.name;document.getElementById('edit-product-sku').value=x.sku||'';document.getElementById('edit-product-price').value=x.price;document.getElementById('edit-product-pack').value=x.pack;document.getElementById('edit-product-status').value=x.status||'Active';document.getElementById('product-modal').classList.remove('hidden');}
        async function saveProductEdit(e){e.preventDefault();try{await apiPost({action:'updateProduct',productId:document.getElementById('edit-product-id').value,productName:document.getElementById('edit-product-name').value,sku:document.getElementById('edit-product-sku').value,pricePerPcs:+document.getElementById('edit-product-price').value,unitsPerBox:+document.getElementById('edit-product-pack').value,status:document.getElementById('edit-product-status').value});closeModal('product-modal');await refreshOnlineData();showToast('Produk diperbarui');}catch(err){showToast(err.message);}}
        async function saveSalesEdit(){const id=document.getElementById('edit-sales-id').value;try{await apiPost({action:'updateSales',salesId:id,name:document.getElementById('edit-sales-name').value,phone:document.getElementById('edit-sales-phone').value,area:document.getElementById('edit-sales-area').value,username:document.getElementById('edit-sales-user').value,targetVisit:+document.getElementById('edit-sales-visit').value,targetPcs:+document.getElementById('edit-sales-box').value});await refreshOnlineData();openSalesModal(id);showToast('Data Sales diperbarui');}catch(err){showToast(err.message);}}
        async function toggleSalesFromModal(){const id=document.getElementById('edit-sales-id').value,s=db.sales.find(x=>x.id===id);try{await apiPost({action:'setSalesStatus',salesId:id,status:s?.active===false?'Active':'Inactive'});await refreshOnlineData();openSalesModal(id);}catch(err){showToast(err.message);}}
        async function resetSalesPasswordFromModal(){const id=document.getElementById('edit-sales-id').value;const p=prompt('Masukkan password baru (minimal 6 karakter):');if(!p)return;try{await apiPost({action:'resetSalesPassword',salesId:id,newPassword:p});showToast('Password Sales berhasil diubah');}catch(err){showToast(err.message);}}
        async function transferSalesStoresFromModal(){const from=document.getElementById('edit-sales-id').value,to=document.getElementById('transfer-sales-target').value;if(!to){showToast('Pilih Sales pengganti');return;}if(!confirm('Alihkan semua toko Sales ini ke Sales pengganti? Histori lama tidak akan diubah.'))return;try{const r=await apiPost({action:'transferSalesStores',fromSalesId:from,toSalesId:to});await refreshOnlineData();openSalesModal(from);showToast(r.message);}catch(err){showToast(err.message);}}

function renderDynamicForms(){
          const ms=document.getElementById('m-store-sales');
          if(ms){const old=ms.value;ms.innerHTML='<option value="">Pilih sales penanggung jawab</option>'+db.sales.filter(s=>s.active!==false).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');ms.value=old;}
          const vs=document.getElementById('visit-store'),is=document.getElementById('invoice-store'),ip=document.getElementById('invoice-products');
          if(vs)vs.innerHTML='<option value="">Pilih toko yang dikunjungi</option>'+db.stores.map(x=>`<option value="${x.id}" data-lat="${x.lat}" data-lng="${x.lng}">${x.name}</option>`).join('');
          if(is)is.innerHTML='<option value="">-- Pilih Toko Terdaftar --</option>'+db.stores.map(x=>`<option value="${x.id}">${x.name}${x.owner?' ('+x.owner+')':''}</option>`).join('');
          if(ip)ip.innerHTML=db.products.map(x=>`<div class="invoice-item border rounded-xl bg-white p-3" data-product-id="${x.id}" data-product-name="${escapeHtml(x.name)}">
            <div class="flex justify-between gap-2 mb-2"><span class="text-xs font-bold">${escapeHtml(x.name)}</span><span class="text-[10px] text-slate-400">Acuan Rp ${x.price.toLocaleString('id-ID')}/PCS</span></div>
            <div class="grid grid-cols-3 gap-2">
              <label class="text-[10px] text-slate-500">Qty PCS<input type="number" min="0" step="1" value="0" class="product-qty mt-1 w-full px-2 py-2 rounded-lg border text-xs font-bold" oninput="calculateInvoiceTotal()"></label>
              <label class="text-[10px] text-slate-500">Harga/PCS<input type="number" min="0" step="1" value="${x.price}" class="product-price mt-1 w-full px-2 py-2 rounded-lg border text-xs font-bold" oninput="calculateInvoiceTotal()"></label>
              <label class="text-[10px] text-slate-500">Diskon/PCS<input type="number" min="0" step="1" value="0" class="product-discount mt-1 w-full px-2 py-2 rounded-lg border text-xs font-bold" oninput="calculateInvoiceTotal()"></label>
            </div>
            <div class="text-right text-[11px] mt-2 text-indigo-700">Total: <b class="product-line-total">Rp 0</b></div>
          </div>`).join(''); calculateInvoiceTotal();
        }
        let onboardingGps=null, onboardingPhoto=null;
        function captureGps(){
          if(!navigator.geolocation){showToast('GPS tidak didukung perangkat');return;}
          const s=document.getElementById('gps-status');if(s)s.innerText='Mengambil lokasi GPS...';
          navigator.geolocation.getCurrentPosition(pos=>{
            onboardingGps={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy||0};
            if(s)s.innerText=`✓ GPS didapat · akurasi ±${Math.round(onboardingGps.accuracy)} m`;
            showToast('Lokasi GPS berhasil diambil');
          },err=>{if(s)s.innerText='GPS gagal: '+err.message;showToast('GPS gagal: '+err.message);},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
        }
        function triggerCamera(){document.getElementById('store-photo-input')?.click();}
        function handleStorePhoto(input){
          const file=input?.files?.[0];if(!file)return;
          const reader=new FileReader();
          reader.onload=ev=>{
            const img=new Image();img.onload=()=>{
              const max=1280,scale=Math.min(1,max/img.width),c=document.createElement('canvas');
              c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
              c.getContext('2d').drawImage(img,0,0,c.width,c.height);
              onboardingPhoto=c.toDataURL('image/jpeg',0.72);
              const s=document.getElementById('photo-status');if(s)s.innerText='✓ Foto siap · '+Math.round(onboardingPhoto.length/1024)+' KB';
              showToast('Foto toko siap disimpan');
            };img.src=ev.target.result;
          };reader.readAsDataURL(file);
        }
        async function handleStoreSubmit(e){
          e.preventDefault();
          if(!onboardingGps){showToast('Ambil lokasi GPS toko terlebih dahulu');return;}
          if(!onboardingPhoto){showToast('Ambil foto tampak toko terlebih dahulu');return;}
          try{
            await apiPost({action:'addStore',storeName:document.getElementById('store-name').value.trim(),ownerName:document.getElementById('owner-name').value.trim(),whatsapp:document.getElementById('store-wa')?.value||'',address:document.getElementById('store-address')?.value||'',latitude:onboardingGps.lat,longitude:onboardingGps.lng,gpsAccuracy:onboardingGps.accuracy,photoBase64:onboardingPhoto,photoMimeType:'image/jpeg'});
            e.target.reset();onboardingGps=null;onboardingPhoto=null;
            const gs=document.getElementById('gps-status');if(gs)gs.innerText='Belum diambil (Tekan tombol di samping)';
            const ps=document.getElementById('photo-status');if(ps)ps.innerText='Belum ada foto diambil';
            await refreshOnlineData(false);showToast('Toko berhasil didaftarkan online');
          }catch(err){showToast('Gagal mendaftarkan toko: '+err.message);}
        }

        function fillCurrentStoreGps(){if(!navigator.geolocation){showToast('GPS tidak tersedia');return;} navigator.geolocation.getCurrentPosition(p=>{document.getElementById('m-store-lat').value=p.coords.latitude.toFixed(7);document.getElementById('m-store-lng').value=p.coords.longitude.toFixed(7);showToast('Koordinat terisi');},e=>showToast('GPS gagal: '+e.message),{enableHighAccuracy:true});}
        function periodMatch(dateStr,period){const d=new Date(dateStr),n=new Date();if(isNaN(d))return false;if(period==='daily')return d.toDateString()===n.toDateString();if(period==='weekly'){const x=new Date(n);x.setDate(n.getDate()-6);x.setHours(0,0,0,0);return d>=x&&d<=n;}return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth();}
        function renderAdminDashboard(period='monthly'){
          const visits=(db.visits||[]).filter(v=>periodMatch(v.checkIn||v.date,period));
          const orders=(db.orders||[]).filter(o=>periodMatch(o.date,period));
          const set=(id,v)=>{const e=document.getElementById(id);if(e)e.innerText=v;};
          set('admin-total-omzet',rupiah(orders.reduce((n,o)=>n+o.total,0)));set('admin-total-visits',visits.length+' Toko');set('admin-total-pcs',orders.reduce((n,o)=>n+o.qty,0)+' PCS');set('admin-active-sales',(db.sales||[]).filter(s=>s.active!==false).length+' Orang');
          const body=document.getElementById('leaderboard-tbody');
          const rows=(db.sales||[]).map(s=>{const v=visits.filter(x=>x.salesId===s.id),o=orders.filter(x=>x.salesId===s.id),qty=o.reduce((n,x)=>n+x.qty,0);const factor=period==='daily'?1:period==='weekly'?7:25;const tv=period==='monthly'?s.targetVisit:Math.ceil((s.targetVisit||0)/25*factor),tq=period==='monthly'?s.targetBox:Math.ceil((s.targetBox||0)/25*factor);const score=((tv?v.length/tv:0)+(tq?qty/tq:0))/2;return {s,v:v.length,o:o.length,qty,tv,tq,score,omzet:o.reduce((n,x)=>n+x.total,0)}}).sort((a,b)=>b.score-a.score);
          if(body)body.innerHTML=rows.map((r,i)=>`<tr><td class="py-3 px-6"><b>${i+1}. ${escapeHtml(r.s.name)}</b><br><span class="text-slate-400">${escapeHtml(r.s.area||'-')}</span></td><td class="text-center">${r.tv}</td><td class="text-center">${r.v}</td><td class="text-center">${r.tq}</td><td class="text-center">${r.qty}</td><td class="px-6 text-right font-bold">${Math.round(r.score*100)}%</td></tr>`).join('')||'<tr><td colspan="6" class="py-8 px-6 text-center text-slate-400">Belum ada data kinerja sales.</td></tr>';
          const ob=document.getElementById('admin-operational-body');if(ob)ob.innerHTML=rows.map(r=>`<tr><td class="p-2"><b>${escapeHtml(r.s.name)}</b></td><td class="text-center">${r.v}</td><td class="text-center">${r.o}</td><td class="text-center">${r.v?Math.round(r.o/r.v*100):0}%</td><td class="text-center">${r.qty}</td><td class="text-right p-2">${rupiah(r.omzet)}</td></tr>`).join('')||'<tr><td colspan="6" class="p-6 text-center text-slate-400">Belum ada data operasional.</td></tr>';
        }
        function applyOnlineSettings(rows){
          const obj={};rows.forEach(x=>obj[String(x.Key)]=x.Value);
          if(obj.GEOFENCE_RADIUS!==undefined)db.settings.radius=Number(obj.GEOFENCE_RADIUS)||100;
          const r=document.getElementById('admin-radius');if(r)r.value=db.settings.radius;
        }
        async function saveAdminSettings(){try{const radius=+document.getElementById('admin-radius').value||100;await apiPost({action:'updateSettings',geofenceRadius:radius});db.settings.radius=radius;saveDb();showToast('Radius GPS tersimpan online');}catch(err){showToast('Gagal menyimpan pengaturan: '+err.message);}}
        function renderRecentVisits(){
          const grid=document.getElementById('recent-visits-grid');if(!grid)return;
          const rows=(db.visits||[]).slice(0,9);
          grid.innerHTML=rows.map(v=>`<div class="border rounded-2xl p-4 bg-slate-50/60"><div class="flex justify-between gap-2"><div><b class="text-sm">${escapeHtml(v.store||'-')}</b><p class="text-[11px] text-slate-500">${escapeHtml(v.salesName||'-')}</p></div><span class="text-[10px] px-2 py-1 h-fit rounded-lg ${v.distance<=Number(db.settings.radius||100)?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}">${Math.round(v.distance||0)} m</span></div><div class="mt-3 text-[11px] text-slate-600">${v.checkIn?new Date(v.checkIn).toLocaleString('id-ID'):'-'}<br>GPS ±${Math.round(v.accuracy||0)} m · ${v.duration||0} menit<br><b>${v.result==='order'?'Ada order':'Tidak order'}</b>${v.reason?' · '+escapeHtml(v.reason):''}</div></div>`).join('')||'<div class="md:col-span-3 py-6 text-center text-sm text-slate-400">Belum ada kunjungan toko.</div>';
          const total=(db.visits||[]).length,eff=(db.visits||[]).filter(v=>v.result==='order').length,avg=total?Math.round((db.visits||[]).reduce((n,v)=>n+(+v.duration||0),0)/total):0;
          const set=(id,val)=>{const x=document.getElementById(id);if(x)x.innerText=val;};
          set('admin-kpi-visits',total);set('admin-kpi-effective',eff);set('admin-kpi-strike',total?Math.round(eff/total*100)+'%':'0%');set('admin-kpi-duration',avg+' mnt');
        }
        function refreshVisitKpi(){ renderRecentVisits(); renderSalesProgress('daily');const today=new Date().toISOString().slice(0,10); let arr=db.visits.filter(v=>v.date===today); if(currentUser?.role==='sales') arr=arr.filter(v=>v.salesId===currentUser.salesId||v.user===currentUser.username); const eff=arr.filter(v=>v.result==='order').length; visitStats={calls:arr.length,effective:eff,newOutlet:arr.filter(v=>v.newOutlet).length}; const a=document.getElementById('kpi-calls'); if(a){a.innerText=arr.length;document.getElementById('kpi-effective').innerText=eff;document.getElementById('kpi-strike').innerText=arr.length?Math.round(eff/arr.length*100)+'%':'0%';document.getElementById('kpi-new').innerText=visitStats.newOutlet;}}

        function renderSalesProgress(period='daily'){
          const sales=currentUser?.role==='sales'?db.sales.find(x=>x.id===currentUser.salesId):null;
          const now=new Date(); let arr=db.visits.filter(v=>!sales || v.salesId===sales.id);
          if(period==='daily') arr=arr.filter(v=>v.date===now.toISOString().slice(0,10));
          if(period==='weekly'){const start=new Date(now);start.setDate(now.getDate()-6);arr=arr.filter(v=>new Date(v.date)>=new Date(start.toISOString().slice(0,10)));}
          if(period==='monthly') arr=arr.filter(v=>(v.date||'').slice(0,7)===now.toISOString().slice(0,7));
          const factor=period==='daily'?1:period==='weekly'?7:1;
          const targetVisit=sales ? (period==='monthly'?Number(sales.targetVisit||0):Math.ceil(Number(sales.targetVisit||0)/25*factor)) : 0;
          const targetBox=sales ? (period==='monthly'?Number(sales.targetBox||0):Math.ceil(Number(sales.targetBox||0)/25*factor)) : 0;
          let ord=(db.orders||[]).filter(o=>!sales||o.salesId===sales.id);if(period==='daily')ord=ord.filter(o=>periodMatch(o.date,'daily'));if(period==='weekly')ord=ord.filter(o=>periodMatch(o.date,'weekly'));if(period==='monthly')ord=ord.filter(o=>periodMatch(o.date,'monthly'));const sold=ord.reduce((n,o)=>n+Number(o.qty||0),0), visits=arr.length;
          document.getElementById('box-progress-text').innerText=`${sold} / ${targetBox} PCS`; document.getElementById('box-progress-bar').style.width=(targetBox?Math.min(100,sold/targetBox*100):0)+'%'; document.getElementById('box-remaining').innerText=targetBox? (sold>=targetBox?'Target tercapai':`Kurang ${targetBox-sold} PCS lagi`) :'Target belum ditetapkan';
          document.getElementById('visit-progress-text').innerText=`${visits} / ${targetVisit} Toko`; document.getElementById('visit-progress-bar').style.width=(targetVisit?Math.min(100,visits/targetVisit*100):0)+'%'; document.getElementById('visit-remaining').innerText=targetVisit? (visits>=targetVisit?'Target tercapai':`Kurang ${targetVisit-visits} toko lagi`) :'Target belum ditetapkan';
        }
        let activeVisit = null; let visitStats = {calls:0,effective:0,newOutlet:0};
        function distanceMeters(a,b,c,d){ const R=6371000, p=Math.PI/180; const x=(c-a)*p, y=(d-b)*p; const h=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
        function checkInVisit(){
          const sel=document.getElementById('visit-store'); if(!sel.value){showToast('Pilih toko terlebih dahulu');return;}
          if(!navigator.geolocation){showToast('GPS tidak didukung perangkat');return;}
          document.getElementById('visit-info').innerHTML='Mengambil GPS aktual...';
          navigator.geolocation.getCurrentPosition(pos=>{
            const opt=sel.options[sel.selectedIndex], slat=parseFloat(opt.dataset.lat), slng=parseFloat(opt.dataset.lng);
            const dist=distanceMeters(pos.coords.latitude,pos.coords.longitude,slat,slng); const radius=parseInt(document.getElementById('admin-radius')?.value||db.settings.radius||100);
            if(dist>radius){document.getElementById('visit-info').innerHTML=`<span class="text-red-600 font-semibold">Check-in ditolak · jarak ${Math.round(dist)} m, batas ${radius} m.</span>`;return;}
            activeVisit={storeId:sel.value,store:opt.text,checkIn:new Date(),lat:pos.coords.latitude,lng:pos.coords.longitude,distance:dist,accuracy:pos.coords.accuracy||0};
            document.getElementById('visit-badge').className='text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold'; document.getElementById('visit-badge').innerText='Check-in aktif';
            document.getElementById('visit-info').innerHTML=`<span class="text-emerald-700 font-semibold">✓ Lokasi valid · ${Math.round(dist)} m dari titik toko · ${activeVisit.checkIn.toLocaleTimeString('id-ID')}</span>`;
            document.getElementById('visit-result-panel').classList.remove('hidden'); showToast('Check-in kunjungan berhasil');
          },err=>showToast('GPS gagal: '+err.message),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
        }
        function toggleVisitReason(){document.getElementById('no-order-reason').classList.toggle('hidden',document.getElementById('visit-result').value!=='no_order');}
        async function finishVisit(){
          if(!activeVisit){showToast('Belum ada check-in aktif');return;}
          const result=document.getElementById('visit-result').value,end=new Date(),dur=Math.max(1,Math.round((end-activeVisit.checkIn)/60000));
          const reason=result==='no_order'?document.getElementById('no-order-reason').value:'';
          try{
            await apiPost({action:'saveVisit',storeId:activeVisit.storeId,checkInAt:activeVisit.checkIn.toISOString(),checkOutAt:end.toISOString(),latitude:activeVisit.lat,longitude:activeVisit.lng,gpsAccuracy:activeVisit.accuracy||0,distanceMeter:Math.round(activeVisit.distance),durationMinute:dur,result:result,notes:reason});
            document.getElementById('visit-result-panel').classList.add('hidden');
            document.getElementById('visit-badge').className='text-xs px-3 py-1 rounded-full bg-slate-100';
            document.getElementById('visit-badge').innerText='Belum check-in';
            document.getElementById('visit-info').innerHTML=`Kunjungan ${escapeHtml(activeVisit.store)} selesai · durasi ${dur} menit · hasil: ${escapeHtml(result)}.`;
            activeVisit=null;
            await refreshOnlineData(false);
            showToast('Kunjungan tersimpan online');
          }catch(err){showToast('Gagal menyimpan kunjungan: '+err.message);}
        }
        let lastSavedOrder = null;
        let lastInvoiceFingerprint = '';

        function rupiah(n){ return 'Rp '+Math.round(Number(n||0)).toLocaleString('id-ID'); }

        function collectInvoiceItems(){
          return [...document.querySelectorAll('.invoice-item')].map(row=>{
            const qty=Math.max(0,Math.floor(Number(row.querySelector('.product-qty')?.value||0)));
            const price=Math.max(0,Number(row.querySelector('.product-price')?.value||0));
            const discountPerPcs=Math.max(0,Number(row.querySelector('.product-discount')?.value||0));
            const before=qty*price;
            const discount=qty*discountPerPcs;
            const total=Math.max(0,before-discount);
            return {
              productId:row.dataset.productId,
              productName:row.dataset.productName,
              qtyPcs:qty,
              unitPricePcs:price,
              discountPerPcs:discountPerPcs,
              discountAmount:discount,
              subtotalBeforeDiscount:before,
              total:total,
              row:row
            };
          }).filter(x=>x.qtyPcs>0);
        }

        function calculateInvoiceTotal(){
          const items=collectInvoiceItems();
          let qty=0,total=0;
          items.forEach(x=>{
            qty+=x.qtyPcs;
            total+=x.total;
            const el=x.row?.querySelector('.product-line-total');
            if(el)el.innerText=rupiah(x.total);
          });
          document.querySelectorAll('.invoice-item').forEach(row=>{
            const qty=Number(row.querySelector('.product-qty')?.value||0);
            if(!qty){const el=row.querySelector('.product-line-total');if(el)el.innerText='Rp 0';}
          });
          const t=document.getElementById('invoice-total-display');
          const q=document.getElementById('invoice-qty-display');
          if(t)t.innerText=rupiah(total);
          if(q)q.innerText=qty+' PCS';
          return {items,totalQtyPcs:qty,grandTotal:total};
        }

        function validateInvoice(){
          const storeId=document.getElementById('invoice-store').value;
          if(!storeId)throw new Error('Pilih toko terlebih dahulu.');
          const calc=calculateInvoiceTotal();
          if(!calc.items.length)throw new Error('Isi Qty PCS minimal pada satu produk.');
          for(const x of calc.items){
            if(x.discountPerPcs>x.unitPricePcs)throw new Error('Diskon/PCS '+x.productName+' melebihi harga/PCS.');
          }
          return {storeId,...calc,notes:document.getElementById('invoice-notes').value.trim()};
        }

        async function saveInvoiceOrder(){
          const inv=validateInvoice();
          const fingerprint=JSON.stringify({storeId:inv.storeId,notes:inv.notes,items:inv.items.map(x=>[x.productId,x.qtyPcs,x.unitPricePcs,x.discountPerPcs])});
          if(lastSavedOrder && lastInvoiceFingerprint===fingerprint)return lastSavedOrder;
          const res=await apiPost({
            action:'createOrder',
            storeId:inv.storeId,
            salesId:currentUser?.salesId||'',
            notes:inv.notes,
            paymentType:'Tunai',
            items:inv.items.map(x=>({
              productId:x.productId,
              qtyPcs:x.qtyPcs,
              unitPricePcs:x.unitPricePcs,
              discountPerPcs:x.discountPerPcs
            }))
          });
          lastSavedOrder=res.order;
          lastInvoiceFingerprint=fingerprint;
          return res.order;
        }

        async function handleInvoiceSubmit(e){
          e.preventDefault();
          try{
            const order=await saveInvoiceOrder();
            const store=db.stores.find(s=>s.id===order.storeId);
            let wa=String(store?.wa||order.storeWhatsApp||'').replace(/\D/g,'');
            if(wa.startsWith('0'))wa='62'+wa.slice(1);
            if(!wa){showToast('Order tersimpan, tetapi nomor WhatsApp toko belum tersedia.');return;}

            const lines=[
              '*Tmeez - Nota Penjualan*',
              'No: '+order.orderId,
              'Toko: '+order.storeName,
              'Sales: '+order.salesName,
              '',
              ...order.items.map((x,i)=>`${i+1}. ${x.productName}\n${x.qtyPcs} PCS × ${rupiah(x.unitPricePcs)}${x.discountPerPcs?'\nDiskon '+rupiah(x.discountPerPcs)+'/PCS × '+x.qtyPcs+' = '+rupiah(x.discountAmount):''}\n= ${rupiah(x.total)}`),
              '',
              'Subtotal: '+rupiah(order.subtotal),
              'Diskon: '+rupiah(order.discount),
              '*TOTAL: '+rupiah(order.grandTotal)+'*',
              order.notes?'Catatan: '+order.notes:'',
              '',
              'Terima kasih.'
            ].filter(Boolean);
            window.open('https://wa.me/'+wa+'?text='+encodeURIComponent(lines.join('\n')),'_blank','noopener');
            showToast('Order tersimpan & WhatsApp dibuka');
          }catch(err){showToast('Gagal: '+err.message);}
        }

        async function downloadPdfInvoice(){
          try{
            validateInvoice();
            const order=await saveInvoiceOrder();
            if(!window.jspdf?.jsPDF)throw new Error('Modul PDF belum termuat. Pastikan internet aktif lalu muat ulang aplikasi.');
            const {jsPDF}=window.jspdf;
            const doc=new jsPDF({unit:'mm',format:'a4'});
            const W=210, margin=15;
            // Header modern
            doc.setFillColor(15,23,42);doc.roundedRect(10,10,190,38,4,4,'F');
            doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(22);doc.text('TMEEZ',margin,25);
            doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('SALES INVOICE',margin,32);
            doc.setFontSize(10);doc.text(order.orderId,195,23,{align:'right'});doc.text(order.orderDate,195,30,{align:'right'});
            doc.setTextColor(15,23,42);
            let y=58;
            doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(100,116,139);doc.text('DITAGIHKAN KEPADA',15,y);doc.text('SALES',120,y);y+=6;
            doc.setTextColor(15,23,42);doc.setFontSize(12);doc.text(String(order.storeName||'-'),15,y);doc.text(String(order.salesName||'-'),120,y);y+=12;
            // table header
            doc.setFillColor(241,245,249);doc.roundedRect(15,y-5,180,9,2,2,'F');
            doc.setFontSize(8);doc.setFont('helvetica','bold');
            doc.text('PRODUK',18,y);doc.text('QTY',105,y,{align:'right'});doc.text('HARGA/PCS',135,y,{align:'right'});doc.text('DISC/PCS',163,y,{align:'right'});doc.text('TOTAL',192,y,{align:'right'});y+=9;
            doc.setFont('helvetica','normal');
            order.items.forEach(x=>{
              if(y>260){doc.addPage();y=20;}
              doc.setFontSize(9);doc.text(String(x.productName||'').slice(0,40),18,y);
              doc.text(String(x.qtyPcs),105,y,{align:'right'});
              doc.text(Math.round(x.unitPricePcs).toLocaleString('id-ID'),135,y,{align:'right'});
              doc.text(Math.round(x.discountPerPcs||0).toLocaleString('id-ID'),163,y,{align:'right'});
              doc.setFont('helvetica','bold');doc.text(Math.round(x.total).toLocaleString('id-ID'),192,y,{align:'right'});doc.setFont('helvetica','normal');
              y+=7;doc.setDrawColor(226,232,240);doc.line(15,y-3,195,y-3);
            });
            y+=5;
            doc.setFillColor(248,250,252);doc.roundedRect(112,y-4,83,30,3,3,'F');
            doc.setFontSize(9);doc.text('Subtotal',118,y+2);doc.text(rupiah(order.subtotal),190,y+2,{align:'right'});
            doc.text('Diskon',118,y+9);doc.text(rupiah(order.discount),190,y+9,{align:'right'});
            doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('TOTAL',118,y+19);doc.text(rupiah(order.grandTotal),190,y+19,{align:'right'});
            y+=38;
            if(order.notes){doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(100,116,139);doc.text('CATATAN',15,y);y+=5;doc.setFont('helvetica','normal');doc.setTextColor(15,23,42);doc.text(doc.splitTextToSize(order.notes,170),15,y);}
            doc.setFontSize(8);doc.setTextColor(100,116,139);doc.text('Terima kasih telah berbelanja produk Tmeez.',105,286,{align:'center'});
            const safe=String(order.storeName||'toko').replace(/[^a-z0-9_-]+/gi,'_');
            doc.save(`Tmeez_${order.orderId}_${safe}.pdf`);
            showToast('PDF modern berhasil dibuat');
          }catch(err){showToast('PDF gagal: '+err.message);}
        }

        function exportCsv(){
          const rows=[['Sales','Toko','Tanggal','Hasil','Durasi Menit','Jarak Meter']];
          db.visits.forEach(v=>rows.push([v.salesName||'',v.store||'',v.date||'',v.result||'',v.duration||'',Math.round(v.distance||0)]));
          const csv=rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
          const blob=new Blob([csv],{type:'text/csv'}), a=document.createElement('a');
          a.href=URL.createObjectURL(blob); a.download='laporan-sales.csv'; a.click(); URL.revokeObjectURL(a.href);
        }

        // Toast Notification Helper
        function showToast(message) {
            const toast = document.getElementById('toast');
            document.getElementById('toast-message').innerText = message;
            toast.classList.remove('translate-y-24', 'opacity-0');
            setTimeout(() => {
                toast.classList.add('translate-y-24', 'opacity-0');
            }, 3000);
        }
    