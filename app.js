const STORAGE_KEY = 'solaces_inventory_items';
const SALES_KEY = 'solaces_sales_history';

let inventory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let salesHistory = JSON.parse(localStorage.getItem(SALES_KEY)) || [];

const inventoryTableBody = document.getElementById('inventoryTableBody');
const salesHistoryTableBody = document.getElementById('salesHistoryTableBody');
const statTotalItems = document.getElementById('statTotalItems');
const statSalesCount = document.getElementById('statSalesCount');
const searchInput = document.getElementById('searchInput');

const addItemForm = document.getElementById('addItemForm');
const editItemForm = document.getElementById('editItemForm');
const batchItemForm = document.getElementById('batchItemForm');
const batchRowsContainer = document.getElementById('batchRowsContainer');

document.addEventListener('DOMContentLoaded', () => {
    renderInventory();
    updateMetrics();
    renderSalesHistory();

    if (addItemForm) {
        addItemForm.addEventListener('submit', handleAddItem);
    }
    if (editItemForm) {
        editItemForm.addEventListener('submit', handleEditItem);
    }
    if (batchItemForm) {
        batchItemForm.addEventListener('submit', handleBatchAddItem);
    }
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    const batchModalEl = document.getElementById('batchItemModal');
    if (batchModalEl) {
        batchModalEl.addEventListener('show.bs.modal', () => {
            if (batchRowsContainer && batchRowsContainer.children.length === 0) {
                addBatchRow();
                addBatchRow();
            }
        });
    }
});

function renderInventory(itemsToRender = inventory) {
    if (!inventoryTableBody) return;

    inventoryTableBody.innerHTML = '';

    if (itemsToRender.length === 0) {
        inventoryTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-shirt fa-2x mb-2 text-secondary opacity-50"></i>
                    <p class="mb-0">No garments found in inventory.</p>
                </td>
            </tr>
        `;
        return;
    }

    itemsToRender.forEach(item => {
        const tr = document.createElement('tr');
        
        const formattedPrice = parseFloat(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const agingBadge = getStockAgingBadge(item.dateAdded);

        tr.innerHTML = `
            <td><span class="fw-bold text-dark">${item.id}</span></td>
            <td>${escapeHtml(item.description)}</td>
            <td><span class="badge bg-light text-dark border">${item.size}</span></td>
            <td><span class="badge bg-secondary">${item.category}</span></td>
            <td class="fw-semibold text-success">₱${formattedPrice}</td>
            <td>${agingBadge}</td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-1">
                    <button class="btn btn-outline-action btn-sm text-primary" onclick="openEditModal('${item.id}')" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-outline-action btn-sm text-success" onclick="markAsSold('${item.id}')" title="Mark as Sold">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="btn btn-outline-action btn-sm text-danger" onclick="deleteItem('${item.id}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        inventoryTableBody.appendChild(tr);
    });
}

function generateNextItemId(category) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${yy}${mm}${dd}`;

    const allExistingIds = [...inventory, ...salesHistory.map(s => ({ id: s.itemId }))];
    
    let maxSeq = 0;
    allExistingIds.forEach(item => {
        if (item.id && item.id.includes(`-${category}-`)) {
            const parts = item.id.split('-');
            if (parts.length === 3) {
                const seq = parseInt(parts[2], 10);
                if (!isNaN(seq) && seq > maxSeq) {
                    maxSeq = seq;
                }
            }
        }
    });

    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(3, '0');

    return `${datePrefix}-${category}-${seqStr}`;
}

function handleAddItem(e) {
    e.preventDefault();
    
    const category = document.getElementById('itemCategory').value;
    const description = document.getElementById('itemDescription').value.trim();
    const size = document.getElementById('itemSize').value;
    const price = parseFloat(document.getElementById('itemPrice').value);

    if (!category || !description || !size || isNaN(price)) {
        alert('Please fill in all required fields correctly.');
        return;
    }

    const newItemId = generateNextItemId(category);

    const newItem = {
        id: newItemId,
        category,
        description,
        size,
        price,
        dateAdded: new Date().toISOString()
    };

    inventory.push(newItem);
    saveAndRefresh();

    addItemForm.reset();
    const modalEl = document.getElementById('addItemModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
}

function addBatchRow() {
    if (!batchRowsContainer) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <select class="form-select form-select-sm batch-category" required>
                <option value="" selected disabled>Select...</option>
                <option value="TOP">TOP</option>
                <option value="JKT">JKT</option>
                <option value="DRS">DRS</option>
                <option value="BTM">BTM</option>
                <option value="SKT">SKT</option>
                <option value="OTH">OTH</option>
            </select>
        </td>
        <td>
            <input type="text" class="form-control form-control-sm batch-desc" placeholder="Description..." required>
        </td>
        <td>
            <select class="form-select form-select-sm batch-size" required>
                <option value="" selected disabled>Size...</option>
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
            </select>
        </td>
        <td>
            <input type="number" step="0.01" class="form-control form-control-sm batch-price" placeholder="0.00" required>
        </td>
        <td class="text-center">
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeBatchRow(this)">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    batchRowsContainer.appendChild(tr);
}

function removeBatchRow(btn) {
    const row = btn.closest('tr');
    if (batchRowsContainer.children.length > 1) {
        row.remove();
    } else {
        alert('You must keep at least one row.');
    }
}

function handleBatchAddItem(e) {
    e.preventDefault();

    const categoryInputs = batchRowsContainer.querySelectorAll('.batch-category');
    const descInputs = batchRowsContainer.querySelectorAll('.batch-desc');
    const sizeInputs = batchRowsContainer.querySelectorAll('.batch-size');
    const priceInputs = batchRowsContainer.querySelectorAll('.batch-price');

    let newItemsCount = 0;

    for (let i = 0; i < categoryInputs.length; i++) {
        const category = categoryInputs[i].value;
        const description = descInputs[i].value.trim();
        const size = sizeInputs[i].value;
        const price = parseFloat(priceInputs[i].value);

        if (category && description && size && !isNaN(price)) {
            const newItemId = generateNextItemId(category);

            const newItem = {
                id: newItemId,
                category,
                description,
                size,
                price,
                dateAdded: new Date().toISOString()
            };

            inventory.push(newItem);
            newItemsCount++;
        }
    }

    if (newItemsCount > 0) {
        saveAndRefresh();
        batchRowsContainer.innerHTML = '';
        const modalEl = document.getElementById('batchItemModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        alert(`Successfully encoded ${newItemsCount} items from the bundle!`);
    } else {
        alert('Please fill out at least one complete row.');
    }
}

function openEditModal(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemCategory').value = item.category;
    document.getElementById('editItemDescription').value = item.description;
    document.getElementById('editItemSize').value = item.size;
    document.getElementById('editItemPrice').value = item.price;

    const editModal = new bootstrap.Modal(document.getElementById('editItemModal'));
    editModal.show();
}

function handleEditItem(e) {
    e.preventDefault();

    const id = document.getElementById('editItemId').value;
    const category = document.getElementById('editItemCategory').value;
    const description = document.getElementById('editItemDescription').value.trim();
    const size = document.getElementById('editItemSize').value;
    const price = parseFloat(document.getElementById('editItemPrice').value);

    const index = inventory.findIndex(i => i.id === id);
    if (index !== -1) {
        inventory[index].category = category;
        inventory[index].description = description;
        inventory[index].size = size;
        inventory[index].price = price;

        saveAndRefresh();

        const modalEl = document.getElementById('editItemModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
}

function markAsSold(id) {
    const itemIndex = inventory.findIndex(i => i.id === id);
    if (itemIndex === -1) return;

    if (confirm(`Mark item ${id} as sold?`)) {
        const soldItem = inventory.splice(itemIndex, 1)[0];
        
        const saleRecord = {
            itemId: soldItem.id,
            price: soldItem.price,
            dateSold: new Date().toLocaleString()
        };

        salesHistory.push(saleRecord);
        localStorage.setItem(SALES_KEY, JSON.stringify(salesHistory));
        
        saveAndRefresh();
        renderSalesHistory();
    }
}

function deleteItem(id) {
    if (confirm(`Are you sure you want to delete item ${id}?`)) {
        inventory = inventory.filter(i => i.id !== id);
        saveAndRefresh();
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = inventory.filter(item => 
        item.id.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.size.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
    renderInventory(filtered);
}

function renderSalesHistory() {
    if (!salesHistoryTableBody) return;
    salesHistoryTableBody.innerHTML = '';

    if (salesHistory.length === 0) {
        salesHistoryTableBody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center py-3 text-muted">No sales history recorded yet.</td>
            </tr>
        `;
        return;
    }

    salesHistory.forEach(sale => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">${sale.itemId}</td>
            <td class="text-success fw-semibold">₱${parseFloat(sale.price).toFixed(2)}</td>
            <td class="text-muted small">${sale.dateSold}</td>
        `;
        salesHistoryTableBody.appendChild(tr);
    });
}

function updateMetrics() {
    if (statTotalItems) {
        statTotalItems.textContent = inventory.length;
    }
    if (statSalesCount) {
        statSalesCount.textContent = salesHistory.length;
    }
}

function saveAndRefresh() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
    renderInventory();
    updateMetrics();
    renderSalesHistory();
}

function getStockAgingBadge(dateAddedStr) {
    if (!dateAddedStr) return `<span class="badge-age-green"><i class="fa-solid fa-circle-check me-1"></i> 0d</span>`;
    
    const addedDate = new Date(dateAddedStr);
    const currentDate = new Date();
    const diffTime = currentDate - addedDate;
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    if (diffDays <= 14) {
        return `<span class="badge-age-green"><i class="fa-solid fa-circle-check me-1"></i> ${diffDays}d</span>`;
    } else if (diffDays <= 30) {
        return `<span class="badge-age-yellow"><i class="fa-solid fa-triangle-exclamation me-1"></i> ${diffDays}d</span>`;
    } else {
        return `<span class="badge-age-red"><i class="fa-solid fa-fire me-1"></i> ${diffDays}d</span>`;
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}