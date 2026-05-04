document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const welcomeMessage = document.getElementById('welcomeMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    const fabNewTask = document.getElementById('fabNewTask');
    const taskModal = document.getElementById('taskModal');
    const cancelTaskBtn = document.getElementById('cancelTaskBtn');
    const newTaskForm = document.getElementById('newTaskForm');

    // Initialize App
    checkAuth();

    // --- Authentication ---
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                // Not logged in or session expired
                window.location.href = 'index.html';
                return;
            }
            const data = await res.json();
            welcomeMessage.textContent = `Hello, ${data.user.username}`;
            loadTasks(); // Load tasks only after auth is confirmed
        } catch (err) {
            window.location.href = 'index.html';
        }
    }

    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = 'index.html';
    });

    // --- Task Management ---
    async function loadTasks() {
        try {
            const res = await fetch('/api/tasks');
            if (!res.ok) throw new Error('Failed to fetch tasks');
            const tasks = await res.json();
            renderBoard(tasks);
        } catch (err) {
            console.error(err);
        }
    }

    function renderBoard(tasks) {
        // Clear current columns
        document.getElementById('col-todo').innerHTML = '';
        document.getElementById('col-in_progress').innerHTML = '';
        document.getElementById('col-done').innerHTML = '';

        let counts = { todo: 0, in_progress: 0, done: 0 };

        tasks.forEach(task => {
            const colId = `col-${task.status}`;
            const column = document.getElementById(colId);
            
            if (column) {
                column.appendChild(createTaskCard(task));
                counts[task.status]++;
            }
        });

        // Update counts
        document.getElementById('todo-count').textContent = counts.todo;
        document.getElementById('inprogress-count').textContent = counts.in_progress;
        document.getElementById('done-count').textContent = counts.done;
    }

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        
        const priorityColor = task.priority === 'high' ? 'bg-red' : (task.priority === 'low' ? 'bg-green' : 'bg-yellow');

        // Determine next status for the "Move" button
        let nextStatus = null;
        let moveText = '';
        if (task.status === 'todo') { nextStatus = 'in_progress'; moveText = 'Move →'; }
        else if (task.status === 'in_progress') { nextStatus = 'done'; moveText = 'Complete ✓'; }

        card.innerHTML = `
            <div class="task-header">
                <h3 class="task-title">${task.title}</h3>
                <span class="badge ${priorityColor}">${task.priority}</span>
            </div>
            ${task.description ? `<p class="task-desc">${task.description}</p>` : ''}
            <div class="task-footer">
                <span class="task-assignee">👤 ID: ${task.assigned_to || 'Unassigned'}</span>
                ${nextStatus ? `<button class="btn-move" data-id="${task.id}" data-next="${nextStatus}">${moveText}</button>` : ''}
            </div>
        `;

        // Attach event listener to the move button dynamically
        const moveBtn = card.querySelector('.btn-move');
        if (moveBtn) {
            moveBtn.addEventListener('click', () => updateTaskStatus(task.id, nextStatus));
        }

        return card;
    }

    async function updateTaskStatus(taskId, newStatus) {
        try {
            // Note: We'll need to build this PATCH route in our Express backend next
            const res = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) loadTasks();
        } catch (err) {
            console.error('Failed to update task status', err);
        }
    }

    // --- Modal & Form Handling ---
    fabNewTask.addEventListener('click', () => {
        taskModal.hidden = false;
    });

    cancelTaskBtn.addEventListener('click', () => {
        taskModal.hidden = true;
        newTaskForm.reset();
    });

    newTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newTask = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDesc').value,
            priority: document.getElementById('taskPriority').value,
            assigned_to: parseInt(document.getElementById('taskAssignee').value)
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
                loadTasks(); // Refresh board
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create task');
            }
        } catch (err) {
            console.error('Network error:', err);
        }
    });
});