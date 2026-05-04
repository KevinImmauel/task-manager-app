document.addEventListener('DOMContentLoaded', () => {
    const welcomeMessage = document.getElementById('welcomeMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    const fabNewTask = document.getElementById('fabNewTask');
    const taskModal = document.getElementById('taskModal');
    const cancelTaskBtn = document.getElementById('cancelTaskBtn');
    const newTaskForm = document.getElementById('newTaskForm');

    let currentUserRole = 'dev'; 
    let currentUsername = '';

    checkAuth();

    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                window.location.href = 'index.html';
                return;
            }
            const data = await res.json();
            currentUserRole = data.user.role;
            currentUsername = data.user.username; // Save for stats matching
            
            welcomeMessage.textContent = `${currentUsername} (${currentUserRole.toUpperCase()})`;
            
            if (currentUserRole !== 'lead') {
                fabNewTask.hidden = true;
            }

            loadTasks(); 
            loadUsers();
        } catch (err) {
            window.location.href = 'index.html';
        }
    }

    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = 'index.html';
    });

    async function loadTasks() {
        try {
            const res = await fetch('/api/tasks');
            if (!res.ok) throw new Error('Failed to fetch tasks');
            const tasks = await res.json();
            
            updateStats(tasks); // Update the dashboard metrics
            renderBoard(tasks); // Render the cards
        } catch (err) {
            console.error(err);
        }
    }

    async function loadUsers() {
        try {
            const res = await fetch('/api/auth/users');
            if (!res.ok) return;
            const users = await res.json();
            
            const assigneeSelect = document.getElementById('taskAssignee');
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.username;
                assigneeSelect.appendChild(option);
            });
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    }

    // UPDATED for Dark Mode: Generates a deep, rich color with white text contrast
    function getCategoryColor(category) {
        if (!category) return '#334155';
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${Math.abs(hash) % 360}, 65%, 40%)`; 
    }

    // NEW: Calculate and update dashboard statistics
    function updateStats(tasks) {
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'done').length;
        const review = tasks.filter(t => t.status === 'in_review').length;
        
        // Check if current user's name appears in the assignees string
        const myTasks = tasks.filter(t => 
            t.assignees && t.assignees.includes(currentUsername) && t.status !== 'done'
        ).length;

        const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-progress').textContent = `${progressPercent}%`;
        document.getElementById('stat-review').textContent = review;
        document.getElementById('stat-my-tasks').textContent = myTasks;
    }

    function renderBoard(tasks) {
        document.getElementById('col-todo').innerHTML = '';
        document.getElementById('col-in_progress').innerHTML = '';
        document.getElementById('col-in_review').innerHTML = '';
        document.getElementById('col-done').innerHTML = '';

        let counts = { todo: 0, in_progress: 0, in_review: 0, done: 0 };

        tasks.forEach(task => {
            const colId = `col-${task.status}`;
            const column = document.getElementById(colId);
            
            if (column) {
                column.appendChild(createTaskCard(task));
                counts[task.status]++;
            }
        });

        document.getElementById('todo-count').textContent = counts.todo;
        document.getElementById('inprogress-count').textContent = counts.in_progress;
        document.getElementById('inreview-count').textContent = counts.in_review;
        document.getElementById('done-count').textContent = counts.done;
    }

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        
        const priorityColor = task.priority === 'high' ? 'bg-red' : (task.priority === 'low' ? 'bg-green' : 'bg-yellow');
        const catColor = getCategoryColor(task.category);

        let nextStatus = null;
        let moveText = '';

        if (task.status === 'todo' && currentUserRole === 'dev') {
            nextStatus = 'in_progress'; moveText = 'Start Progress →';
        } else if (task.status === 'in_progress' && currentUserRole === 'dev') {
            nextStatus = 'in_review'; moveText = 'Ask for Review 🔍';
        } else if (task.status === 'in_review' && currentUserRole === 'lead') {
            nextStatus = 'done'; moveText = 'Verify & Complete ✓';
        }

        // Updated card HTML classes to match new styling
        card.innerHTML = `
            <div class="task-header">
                <span class="badge" style="background-color: ${catColor}; color: white; border: 1px solid rgba(255,255,255,0.2);">${task.category || 'General'}</span>
                <span class="badge ${priorityColor}">${task.priority}</span>
            </div>
            <h3 class="task-title">${task.title}</h3>
            ${task.description ? `<p class="task-desc">${task.description}</p>` : ''}
            <div class="task-meta">
                <div><strong>By:</strong> ${task.creator_username || 'Unknown'}</div>
                <div style="margin-top: 4px;"><strong>To:</strong> ${task.assignees || 'Unassigned'}</div>
            </div>
            ${nextStatus ? `
            <div class="task-footer">
                <button class="btn-move" data-id="${task.id}" data-next="${nextStatus}">${moveText}</button>
            </div>` : ''}
        `;

        const moveBtn = card.querySelector('.btn-move');
        if (moveBtn) {
            moveBtn.addEventListener('click', () => updateTaskStatus(task.id, nextStatus));
        }

        return card;
    }

    async function updateTaskStatus(taskId, newStatus) {
        try {
            const res = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (res.ok) {
                loadTasks();
            } else {
                const data = await res.json();
                alert(data.error || 'Action failed');
            }
        } catch (err) {
            console.error('Failed to update task status', err);
        }
    }

    fabNewTask.addEventListener('click', () => { taskModal.hidden = false; });
    cancelTaskBtn.addEventListener('click', () => { taskModal.hidden = true; newTaskForm.reset(); });
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) { taskModal.hidden = true; newTaskForm.reset(); }
    });

    newTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedOptions = Array.from(document.getElementById('taskAssignee').selectedOptions);
        const assignedIds = selectedOptions.map(opt => parseInt(opt.value));
        
        const newTask = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDesc').value,
            category: document.getElementById('taskCategory').value,
            priority: document.getElementById('taskPriority').value,
            assigned_to: assignedIds 
        };

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            });

            if (res.ok) {
                taskModal.hidden = true;
                newTaskForm.reset();
                loadTasks(); 
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create task');
            }
        } catch (err) {
            console.error('Network error:', err);
        }
    });
});