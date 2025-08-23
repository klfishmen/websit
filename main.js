let allProducts = [];
let fishDatabase = new Map();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [productsData, fishData] = await Promise.all([
            fetch('data/products.json').then(response => response.json()),
            fetch('data/fish-database.json').then(response => response.json())
        ]);
        initializeData(productsData, fishData);
        initializeAppUI();
    } catch (error) {
        console.error('資料載入失敗:', error);
    }
});

function initializeData(productsData, fishData) {
    allProducts = productsData;
    fishData.forEach(fish => fishDatabase.set(fish.fish_id, fish));
}

function initializeAppUI() {
    renderProducts(allProducts);
    createFilterButtons();
    initializeEventListeners();
    generateFAQSchema();
}

function isCurrentlyInSeason(product) {
    const fish = fishDatabase.get(product.related_fish_id);
    if (!fish || !fish.peakSeason || ["全年", "不分", "隨魚種而異"].includes(fish.peakSeason)) return product.tags ? product.tags.includes("#季節限定") : false;
    const peakSeason = fish.peakSeason;
    const currentMonth = new Date().getMonth() + 1;
    const rangeMatch = peakSeason.match(/(\d+)月至(\d+)月/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1]), end = parseInt(rangeMatch[2]);
        return start <= end ? (currentMonth >= start && currentMonth <= end) : (currentMonth >= start || currentMonth <= end);
    }
    if (peakSeason.includes("春季") && [3,4,5].includes(currentMonth)) return true;
    if (peakSeason.includes("夏季") && [6,7,8].includes(currentMonth)) return true;
    if (peakSeason.includes("秋季") && [9,10,11].includes(currentMonth)) return true;
    if (peakSeason.includes("冬季") && [12,1,2].includes(currentMonth)) return true;
    return false;
}

function renderProducts(productsToRender) {
    const container = document.getElementById('product-list-container');
    if (!container) return;
    const domain = "https://yourdomain.com";
    container.innerHTML = productsToRender.map(product => {
        const isSeasonal = isCurrentlyInSeason(product);
        const seasonalBadgeHTML = isSeasonal ? `<div class="seasonal-badge">當季</div>` : '';
        const specificationsHTML = product.Specifications ? product.Specifications.replace(/\n/g, '<br>') : '';
        const cbaHTML = (product.cba && product.cba.trim() !== '') ? `<p class="product-cba">${product.cba}</p>` : '';
        const productSchema = {
            "@context": "https://schema.org", "@type": "Product", "name": product.product_name, "image": `${domain}/images/${product.product_id}.jpg`, "description": (product.description || '新鮮海鮮，來自基隆崁仔頂漁市').replace(/"/g, '\\"').replace(/\n/g, ' '), "sku": product.product_id, "brand": { "@type": "Brand", "name": "崁仔頂小商人" }, "offers": { "@type": "Offer", "priceCurrency": "TWD", "price": product.Price, "availability": "https://schema.org/InStock", "url": `${domain}/#order-form` }
        };
        return `
            <div class="product-card">
                <img src="images/${product.product_id}.jpg" alt="${product.product_name}" class="product-image" onerror="this.onerror=null;this.src='images/placeholder.jpg';" data-product-id="${product.product_id}">
                ${seasonalBadgeHTML}
                <h3 class="product-title">${product.product_name}</h3>
                <p class="product-spec">${specificationsHTML}</p>
                <p class="product-price">NT$ ${product.Price}</p>
                ${cbaHTML}
                <div class="product-card-buttons">
                    <button class="btn detail-btn" data-product-id="${product.product_id}">查看詳情</button>
                    <button class="btn share-btn" data-product-id="${product.product_id}" data-product-name="${product.product_name}">分享</button>
                </div>
                <script type="application/ld+json">${JSON.stringify(productSchema)}</script>
            </div>
        `;
    }).join('');
}

function createFilterButtons() {
    const container = document.getElementById('filter-buttons-container');
    if (!container) return;
    const categories = ['全部商品', ...new Set(allProducts.map(p => p.Category).filter(c => c && c.trim() !== ''))];
    container.innerHTML = categories.map(category => `<button class="filter-btn">${category}</button>`).join('');
    container.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', (event) => filterProducts(event.target.textContent));
    });
}

function filterProducts(category) {
    const filtered = (category === '全部商品') ? allProducts : allProducts.filter(p => p.Category === category);
    renderProducts(filtered);
}

function initializeEventListeners() {
    const modal = document.getElementById('product-modal');
    const closeBtn = document.querySelector('.modal-close-btn');
    const productListContainer = document.getElementById('product-list-container');
    if (!modal || !closeBtn || !productListContainer) return;
    closeBtn.addEventListener('click', () => modal.classList.remove('visible'));
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.classList.remove('visible'); });
    productListContainer.addEventListener('click', (event) => {
        const target = event.target;
        const card = target.closest('.product-card');
        if (!card) return;
        const productId = target.dataset.productId;
        if (!productId) {
            const cardProductId = card.querySelector('.btn')?.dataset.productId;
            if(cardProductId) openProductModal(cardProductId);
            return;
        }
        if (target.matches('.share-btn')) {
            const productName = target.dataset.productName;
            shareProduct(productId, productName);
        } else {
            openProductModal(productId);
        }
    });
}

function openProductModal(productId) {
    const product = allProducts.find(p => p.product_id === productId);
    if (!product) return;
    const domain = "https://yourdomain.com";
    document.querySelector('meta[property="og:title"]').setAttribute('content', `${product.product_name} - 崁仔頂小商人`);
    document.querySelector('meta[property="og:description"]').setAttribute('content', (product.description || '新鮮海鮮，立即訂購！').substring(0, 100) + '...');
    document.querySelector('meta[property="og:image"]').setAttribute('content', `${domain}/images/${product.product_id}.jpg`);
    document.querySelector('meta[property="og:url"]').setAttribute('content', `${domain}/#product-${product.product_id}`);
    const modal = document.getElementById('product-modal');
    const modalBody = document.getElementById('modal-body-content');
    modalBody.innerHTML = `
        <h2 class="modal-product-title">${product.product_name}</h2>
        <p class="modal-product-description">${product.description || '暫無詳細說明。'}</p>
        <div class="modal-order-cta">
            <button onclick="prefillAndScroll('${product.product_name}')" class="cta-button">我要訂購此商品</button>
        </div>
    `;
    modal.classList.add('visible');
}

function prefillAndScroll(productName) {
    const prefillEntryId = 'entry.xxxxxxxxxx'; 
    const formIframe = document.querySelector('.google-form-container iframe');
    if (!formIframe) return;
    const formBaseUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSeSz0oHxaZ0TqcneHpb9CmQ_kuGglYxutF1bMmYJRHJKb5aLA/viewform';
    const finalFormUrl = `${formBaseUrl}?usp=pp_url&${prefillEntryId}=${encodeURIComponent(productName)}`;
    formIframe.src = finalFormUrl;
    document.getElementById('product-modal').classList.remove('visible');
    document.getElementById('order-form').scrollIntoView({ behavior: 'smooth' });
}

function shareProduct(id, name) {
    const product = allProducts.find(p => p.product_id === id);
    if (!product) return;
    const url = `https://yourdomain.com/#product-${id}`;
    const text = `看看我在「崁仔頂小商人」找到的${name}，超新鮮的！ #海鮮 #崁仔頂 #基隆美食`;
    if (navigator.share) {
        navigator.share({ title: `分享好料：${name}`, text: text, url: url, }).catch(console.error);
    } else {
        navigator.clipboard.writeText(`${text} ${url}`).then(() => {
            alert('已複製分享內容到剪貼簿，可以貼到 Threads 或其他地方！');
            const fbSharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
            window.open(fbSharerUrl, 'facebook-share-dialog', 'width=800,height=600');
        });
    }
}

function generateFAQSchema() {
    const qaItems = document.querySelectorAll('.qa-item');
    if (qaItems.length === 0) return;
    const faqs = Array.from(qaItems).map(item => {
        const question = item.querySelector('dt')?.textContent.trim();
        const answer = item.querySelector('dd')?.textContent.trim();
        if (!question || !answer) return null;
        return { "@type": "Question", "name": question, "acceptedAnswer": { "@type": "Answer", "text": answer } };
    }).filter(Boolean);
    if (faqs.length > 0) {
        const schema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs };
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
    }
}