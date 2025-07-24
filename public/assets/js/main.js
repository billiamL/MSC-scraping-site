// Prevent multiple declarations
if (typeof window.ConnectionsTable === 'undefined') {
    window.ConnectionsTable = class ConnectionsTable {
        constructor() {
            this.data = [];
            this.filteredData = [];
            this.currentPage = 1;
            this.itemsPerPage = 50;
            this.sortColumn = null;
            this.sortDirection = 'asc';
            this.searchTerm = '';
            this.typeFilter = '';
            
            this.initializeElements();
            this.setupEventListeners();
            this.setupFileUpload();
        }

    initializeElements() {
        this.tableBody = document.getElementById('tableBody');
        this.searchInput = document.getElementById('searchInput');
        this.typeFilter = document.getElementById('typeFilter');
        this.uploadFilter = document.getElementById('uploadFilter');
        this.totalCount = document.getElementById('totalCount');
        this.filteredCount = document.getElementById('filteredCount');
        this.pageInfo = document.getElementById('pageInfo');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.fileInput = document.getElementById('fileInput');
        this.mainControls = document.getElementById('mainControls');
        this.controls = document.getElementById('controls');
        this.saveControls = document.getElementById('saveControls');
        this.tableContainer = document.getElementById('tableContainer');
        this.saveToFirebaseBtn = document.getElementById('saveToFirebase');
        this.loadFromFirebaseBtn = document.getElementById('loadFromFirebase');
        this.uploadNameInput = document.getElementById('uploadName');
        this.firebaseStatus = document.getElementById('firebaseStatus');
        this.showUploadBtn = document.getElementById('showUploadBtn');
        this.showHistoryBtn = document.getElementById('showHistoryBtn');
        this.uploadPanel = document.getElementById('uploadPanel');
        this.historyPanel = document.getElementById('historyPanel');
        this.uploadNameContainer = document.getElementById('uploadNameContainer');
        this.historyList = document.getElementById('historyList');
        
        this.historicalData = []; // Store all historical data
        this.currentUploadData = []; // Current CSV data only
    }

    setupFileUpload() {
        // File input change event
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'text/csv') {
                this.handleFile(file);
            } else if (file) {
                alert('Please upload a CSV file');
            }
        });
    }

    handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.parseCSV(e.target.result);
            this.showTable();
            this.showUploadControls();
        };
        reader.readAsText(file);
    }

    showTable() {
        if (this.controls) this.controls.style.display = 'grid';
        if (this.saveControls) this.saveControls.style.display = 'block';
        if (this.tableContainer) this.tableContainer.style.display = 'block';
    }

    showUploadControls() {
        this.uploadNameContainer.style.display = 'flex';
    }

    toggleUploadPanel() {
        if (this.uploadPanel.style.display === 'none' || this.uploadPanel.style.display === '') {
            this.uploadPanel.style.display = 'block';
            this.historyPanel.style.display = 'none';
        } else {
            this.uploadPanel.style.display = 'none';
        }
    }

    toggleHistoryPanel() {
        if (this.historyPanel.style.display === 'none' || this.historyPanel.style.display === '') {
            this.historyPanel.style.display = 'block';
            this.uploadPanel.style.display = 'none';
            this.loadUploadHistory();
        } else {
            this.historyPanel.style.display = 'none';
        }
    }

    async loadUploadHistory() {
        if (!window.firebase) {
            this.historyList.innerHTML = '<div class="loading">Firebase not initialized</div>';
            return;
        }

        try {
            this.historyList.innerHTML = '<div class="loading">Loading upload history...</div>';
            
            const q = window.firebase.query(
                window.firebase.collection(window.firebase.db, 'linkedin_connections'),
                window.firebase.orderBy('created_at', 'desc')
            );
            
            const querySnapshot = await window.firebase.getDocs(q);
            const uploads = {};
            
            // Group connections by upload name
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const uploadName = data.upload_name;
                if (uploadName && !uploads[uploadName]) {
                    uploads[uploadName] = {
                        name: uploadName,
                        date: data.created_at,
                        count: 0
                    };
                }
                if (uploadName) {
                    uploads[uploadName].count++;
                }
            });

            const uploadList = Object.values(uploads);
            
            if (uploadList.length === 0) {
                this.historyList.innerHTML = '<div style="text-align: center; color: rgba(255, 255, 255, 0.6); padding: 2rem;">No upload history found</div>';
            } else {
                // Generate HTML for each upload, now including the delete button
                this.historyList.innerHTML = uploadList.map(upload => `
                    <div class="history-item">
                        <div class="history-item-info">
                            <div class="history-name">${this.escapeHtml(upload.name)}</div>
                            <div class="history-date">${this.formatDate(upload.date?.toDate?.() || upload.date)}</div>
                        </div>
                        <div class="history-count">${upload.count} connections</div>
                        <button class="delete-upload-btn" data-upload-name="${this.escapeHtml(upload.name)}" title="Delete this upload">
                            🗑️
                        </button>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading upload history:', error);
            this.historyList.innerHTML = '<div style="text-align: center; color: #f87171; padding: 2rem;">Error loading history</div>';
        }
    }

    async deleteUploadByName(uploadName) {
        if (!window.firebase) {
            this.showFirebaseStatus('Firebase not initialized.', 'error');
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete the upload "${uploadName}"?\n\nThis action will permanently remove all of its associated connections and cannot be undone.`);

        if (!confirmed) {
            return; 
        }

        try {
            this.showFirebaseStatus(`Deleting "${uploadName}"...`, 'loading');

            // 2. Create a query to find all documents with the matching 'upload_name'
            const q = window.firebase.query(
                window.firebase.collection(window.firebase.db, 'linkedin_connections'),
                window.firebase.where('upload_name', '==', uploadName)
            );

            const querySnapshot = await window.firebase.getDocs(q);
            
            if (querySnapshot.empty) {
                this.showFirebaseStatus('Could not find that upload to delete.', 'error');
                return;
            }

            // 3. Create an array of delete promises for each document found.
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(window.firebase.deleteDoc(doc.ref));
            });

            // 4. Execute all delete operations at once.
            await Promise.all(deletePromises);

            this.showFirebaseStatus(`Successfully deleted ${querySnapshot.size} connections.`, 'success');
            
            // 5. Refresh the history list to show that the item has been removed.
            this.loadUploadHistory();

        } catch (error) {
            console.error('Error deleting upload:', error);
            this.showFirebaseStatus('An error occurred while deleting. See console for details.', 'error');
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const rawData = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length >= headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header.toLowerCase().replace(/[^a-z0-9]/g, '_')] = values[index] || '';
                });
                rawData.push(row);
            }
        }
        
        // Process data to find historical changes
        this.currentUploadData = this.processHistoricalData(rawData);
        this.data = [...this.currentUploadData]; // Start with current data
        this.filteredData = [...this.data];
        this.updateStats();
        this.renderTable();
        
        // Auto-generate upload name
        const now = new Date();
        this.uploadNameInput.value = now.toLocaleString('en-US', { 
            month: 'long', 
            year: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    processHistoricalData(rawData) {
        // Group by name to track historical changes
        const nameGroups = {};
        rawData.forEach(row => {
            const name = row.name;
            if (!nameGroups[name]) {
                nameGroups[name] = [];
            }
            nameGroups[name].push(row);
        });

        // Process each person to calculate deltas
        const processedData = [];
        Object.keys(nameGroups).forEach(name => {
            const entries = nameGroups[name].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            if (entries.length >= 2) {
                // Has historical data
                const latest = entries[entries.length - 1];
                const previous = entries[entries.length - 2];
                
                const currentMutual = this.extractMutualConnectionsNumber(latest.mutual_connections);
                const previousMutual = this.extractMutualConnectionsNumber(previous.mutual_connections);
                const delta = currentMutual - previousMutual;
                
                processedData.push({
                    name: latest.name,
                    url: latest.url,
                    mutual_connections: currentMutual,
                    previous_mutual_connections: previousMutual,
                    delta: delta,
                    timestamp: latest.timestamp
                });
            } else {
                // Only current data available
                const current = entries[0];
                const currentMutual = this.extractMutualConnectionsNumber(current.mutual_connections);
                
                processedData.push({
                    name: current.name,
                    url: current.url,
                    mutual_connections: currentMutual,
                    previous_mutual_connections: 0, // No historical data
                    delta: currentMutual, // Assume started from 0
                    timestamp: current.timestamp
                });
            }
        });
        
        return processedData;
    }

    extractMutualConnectionsNumber(mutualConnectionsText) {
        if (!mutualConnectionsText) return 0;
        const match = mutualConnectionsText.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    // Firebase Methods
    async saveToFirebase() {
        if (!window.firebase) {
            this.showFirebaseStatus('Firebase not initialized. Please check your config.', 'error');
            return;
        }

        const uploadName = this.uploadNameInput.value.trim();
        if (!uploadName) {
            this.showFirebaseStatus('Please enter a name for this upload.', 'error');
            return;
        }

        try {
            this.showFirebaseStatus('Saving to database...', 'loading');
            
            const batch = [];
            this.currentUploadData.forEach(connection => {
                batch.push({
                    ...connection,
                    upload_name: uploadName,
                    created_at: new Date()
                });
            });

            // Save all connections in batches
            for (let i = 0; i < batch.length; i += 50) { // Firestore batch limit
                const chunk = batch.slice(i, i + 50);
                await Promise.all(
                    chunk.map(connection => 
                        window.firebase.addDoc(
                            window.firebase.collection(window.firebase.db, 'linkedin_connections'), 
                            connection
                        )
                    )
                );
            }

            this.showFirebaseStatus(`Successfully saved ${batch.length} connections to database!`, 'success');
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            this.showFirebaseStatus('Error saving to database. Check console for details.', 'error');
        }
    }

    async loadFromFirebase() {
        if (!window.firebase) {
            this.showFirebaseStatus('Firebase not initialized. Please check your config.', 'error');
            return;
        }

        try {
            this.showFirebaseStatus('Loading historical data...', 'loading');
            
            const q = window.firebase.query(
                window.firebase.collection(window.firebase.db, 'linkedin_connections'),
                window.firebase.orderBy('created_at', 'desc')
            );
            
            const querySnapshot = await window.firebase.getDocs(q);
            this.historicalData = [];
            
            querySnapshot.forEach((doc) => {
                this.historicalData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Calculate deltas across all historical data
            this.data = this.calculateHistoricalDeltas(this.historicalData);
            this.filteredData = [...this.data];
            this.updateStats();
            this.renderTable();
            
            this.showFirebaseStatus(`Loaded ${this.historicalData.length} historical records!`, 'success');
        } catch (error) {
            console.error('Error loading from Firebase:', error);
            this.showFirebaseStatus('Error loading from database. Check console for details.', 'error');
        }
    }

    calculateHistoricalDeltas(historicalData) {
        // Group by name to track changes over time
        const nameGroups = {};
        historicalData.forEach(record => {
            if (!nameGroups[record.name]) {
                nameGroups[record.name] = [];
            }
            nameGroups[record.name].push(record);
        });

        const processedData = [];
        Object.keys(nameGroups).forEach(name => {
            const entries = nameGroups[name].sort((a, b) => 
                new Date(b.created_at?.toDate?.() || b.created_at) - 
                new Date(a.created_at?.toDate?.() || a.created_at)
            );
            
            if (entries.length >= 2) {
                const latest = entries[0];
                const previous = entries[1];
                
                const currentMutual = latest.mutual_connections || 0;
                const previousMutual = previous.mutual_connections || 0;
                const delta = currentMutual - previousMutual;
                
                processedData.push({
                    name: latest.name,
                    url: latest.url,
                    mutual_connections: currentMutual,
                    previous_mutual_connections: previousMutual,
                    delta: delta,
                    upload_name: latest.upload_name,
                    created_at: latest.created_at
                });
            } else {
                const current = entries[0];
                processedData.push({
                    name: current.name,
                    url: current.url,
                    mutual_connections: current.mutual_connections || 0,
                    previous_mutual_connections: 0,
                    delta: current.mutual_connections || 0,
                    upload_name: current.upload_name,
                    created_at: current.created_at
                });
            }
        });
        
        return processedData;
    }

    showFirebaseStatus(message, type = 'info') {
        this.firebaseStatus.textContent = message;
        this.firebaseStatus.className = `firebase-status ${type}`;
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                this.firebaseStatus.textContent = '';
                this.firebaseStatus.className = 'firebase-status';
            }, 5000);
        }
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/"/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim().replace(/"/g, ''));
        return values;
    }

    setupEventListeners() {
        // Panel toggle buttons
        this.showUploadBtn.addEventListener('click', () => {
            this.toggleUploadPanel();
        });

        this.showHistoryBtn.addEventListener('click', () => {
            this.toggleHistoryPanel();
        });

        this.historyList.addEventListener('click', (e) => {
            // Use .closest() to detect clicks on the delete button or its icon
            const deleteButton = e.target.closest('.delete-upload-btn');
            if (deleteButton) {
                // Retrieve the upload name from the button's data attribute
                const uploadName = deleteButton.dataset.uploadName;
                if (uploadName) {
                    // Call the delete method with the correct name
                    this.deleteUploadByName(uploadName);
                }
            }
        });

        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // Type filter
        this.typeFilter.addEventListener('change', (e) => {
            this.typeFilter = e.target.value;
            this.applyFilters();
        });

        // Upload filter  
        this.uploadFilter.addEventListener('change', (e) => {
            if (e.target.value === 'current') {
                this.data = [...this.currentUploadData];
            } else {
                this.data = this.historicalData.length > 0 ? 
                    this.calculateHistoricalDeltas(this.historicalData) : 
                    [...this.currentUploadData];
            }
            this.applyFilters();
        });

        // Firebase buttons
        this.saveToFirebaseBtn.addEventListener('click', () => {
            this.saveToFirebase();
        });

        this.loadFromFirebaseBtn.addEventListener('click', () => {
            this.loadFromFirebase();
        });

        // Sorting
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.column;
                this.sortData(column);
            });
        });

        // Pagination
        this.prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderTable();
            }
        });

        this.nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderTable();
            }
        });
    }

    applyFilters() {
        this.filteredData = this.data.filter(row => {
            const matchesSearch = !this.searchTerm || 
                row.name.toLowerCase().includes(this.searchTerm);
            
            let matchesType = true;
            if (this.typeFilter) {
                switch(this.typeFilter) {
                    case 'positive':
                        matchesType = row.delta > 0;
                        break;
                    case 'negative':
                        matchesType = row.delta < 0;
                        break;
                    case 'unchanged':
                        matchesType = row.delta === 0;
                        break;
                }
            }
            
            return matchesSearch && matchesType;
        });
        
        this.currentPage = 1;
        this.updateStats();
        this.renderTable();
    }

    sortData(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.filteredData.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle numeric sorting
            if (column === 'mutual_connections' || column === 'previous_mutual_connections' || column === 'delta') {
                aVal = parseInt(aVal) || 0;
                bVal = parseInt(bVal) || 0;
            }

            // Handle string sorting (names)
            if (column === 'name') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        this.updateSortHeaders();
        this.renderTable();
    }

    updateSortHeaders() {
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.column === this.sortColumn) {
                th.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    }

    renderTable() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        if (pageData.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255, 255, 255, 0.6); padding: 3rem;">No connections found matching your criteria</td></tr>';
        } else {
            this.tableBody.innerHTML = pageData.map(row => `
                <tr>
                    <td class="connection-name">
                        ${row.url ? `<a href="${row.url}" target="_blank" class="name-link">${this.escapeHtml(row.name)}</a>` : this.escapeHtml(row.name)}
                    </td>
                    <td class="mutual-connections">${row.mutual_connections}</td>
                    <td class="previous-mutual-connections">${row.previous_mutual_connections}</td>
                    <td class="delta ${this.getDeltaClass(row.delta)}">${this.formatDelta(row.delta)}</td>
                </tr>
            `).join('');
        }

        this.updatePagination();
    }

    getDeltaClass(delta) {
        if (delta > 0) return 'positive';
        if (delta < 0) return 'negative';
        return 'neutral';
    }

    formatDelta(delta) {
        if (delta > 0) return `+${delta}`;
        if (delta < 0) return `${delta}`;
        return '0';
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        this.pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        
        this.prevBtn.disabled = this.currentPage === 1;
        this.nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
    }

    updateStats() {
        // These elements might not exist in the current HTML structure
        if (this.totalCount) this.totalCount.textContent = this.data.length.toLocaleString();
        if (this.filteredCount) this.filteredCount.textContent = this.filteredData.length.toLocaleString();
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        
        let date;
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            // Firestore timestamp
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };
}

// Initialize the table when the page loads - prevent multiple instances
if (typeof window.connectionsTableInstance === 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.connectionsTableInstance = new window.ConnectionsTable();
    });
}