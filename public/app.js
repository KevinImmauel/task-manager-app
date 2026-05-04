document.addEventListener('DOMContentLoaded', () => {
    const welcomeMessage = document.getElementById('welcomeMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const projectsView = document.getElementById('projectsView');
    const tasksView = document.getElementById('tasksView');
    const projectsGrid = document.getElementById('projectsGrid');
    const backToProjectsBtn = document.getElementById('backToProjectsBtn');
    const currentProjectTitle = document.getElementById('currentProjectTitle');

    const fabNewProject = document.getElementById('fabNewProject');
    const projectModal = document.getElementById('projectModal');
    const cancelProjectBtn = document.getElementById('cancelProjectBtn');
    const newProjectForm = document.getElementById('newProjectForm');

    const fabNewTask = document.getElementById('fabNewTask');
    const taskModal = document.getElementById('taskModal');
    const cancelTaskBtn = document.getElementById('cancelTaskBtn');
    const newTaskForm = document.getElementById('newTaskForm');

    let currentUserRole = 'dev'; 
    let currentUsername = '';
    let currentProjectId = null;

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
            currentUsername = data.user.username;
            
            welcomeMessage.textContent = `${currentUsername} (${currentUserRole.toUpperCase()})`;
            
            if (currentUserRole === 'lead' || currentUserRole === 'management') {
                fabNewProject.hidden = false;
            }

            loadProjects(); 
            loadAllUsersForProjects();
        } catch (err) {
            window.location.href = 'index.html';
        }
    }

    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = 'index.html';
    });

    // --- Projects Logic ---

    async function loadProjects() {
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) throw new Error('Failed to fetch projects');
            const projects = await res.json();
            renderProjects(projects);
        } catch (err) {
            console.error(err);
        }
    }

    function renderProjects(projects) {
        projectsGrid.innerHTML = '';
        if (projects.length === 0) {
            projectsGrid.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-secondary);">No projects found.</p>';
            return;
        }

        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <div>
                    <h3 class="project-title">${project.name}</h3>
                    <p class="project-desc">${project.description || 'No description'}</p>
                </div>
                <div class="project-meta" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: 1rem;">
                    <span>Created by: ${project.creator_username || 'Unknown'}</span>
                    <button class="btn-delete-project" style="width: auto; padding: 2px 6px; font-size: 0.8rem; background: transparent; border: 1px solid var(--error-color); color: var(--error-color); border-radius: 4px;">Delete</button>
                </div>
            `;
            
            const deleteBtn = card.querySelector('.btn-delete-project');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete project "${project.name}"?`)) {
                    deleteProject(project.id);
                }
            });

            card.addEventListener('click', () => openProject(project));
            projectsGrid.appendChild(card);
        });
    }

    async function deleteProject(id) {
        try {
            const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadProjects();
            } else {
                alert('Failed to delete project');
            }
        } catch (err) {
            console.error('Error deleting project:', err);
        }
    }

    function openProject(project) {
        currentProjectId = project.id;
        currentProjectTitle.textContent = project.name;
        projectsView.hidden = true;
        tasksView.hidden = false;
        
        if (currentUserRole === 'lead' || currentUserRole === 'management') {
            fabNewProject.hidden = true;
        }
        // Always show the task button when inside a project, for all roles
        fabNewTask.hidden = false;

        loadTasks();
        loadProjectUsers();
    }

    backToProjectsBtn.addEventListener('click', () => {
        currentProjectId = null;
        tasksView.hidden = true;
        projectsView.hidden = false;
        
        fabNewTask.hidden = true;
        if (currentUserRole === 'lead' || currentUserRole === 'management') {
            fabNewProject.hidden = false;
        }
    });

    // --- Users Logic ---

    async function loadAllUsersForProjects() {
        try {
            const res = await fetch('/api/auth/users');
            if (!res.ok) return;
            const users = await res.json();
            
            const assigneeSelect = document.getElementById('projectAssignee');
            assigneeSelect.innerHTML = '';
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.username} (${user.role || 'dev'})`;
                assigneeSelect.appendChild(option);
            });
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    }

    async function loadProjectUsers() {
        if (!currentProjectId) return;
        try {
            const res = await fetch(`/api/projects/${currentProjectId}/users`);
            if (!res.ok) return;
            const users = await res.json();
            
            const assigneeSelect = document.getElementById('taskAssignee');
            assigneeSelect.innerHTML = '';
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.username;
                assigneeSelect.appendChild(option);
            });
        } catch (err) {
            console.error('Failed to load project users:', err);
        }
    }

    // --- Tasks Logic ---

    async function loadTasks() {
        if (!currentProjectId) return;
        try {
            const res = await fetch(`/api/tasks?projectId=${currentProjectId}`);
            if (!res.ok) throw new Error('Failed to fetch tasks');
            const tasks = await res.json();
            
            updateStats(tasks);
            renderBoard(tasks);
        } catch (err) {
            console.error(err);
        }
    }

    function getCategoryColor(category) {
        if (!category) return '#334155';
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${Math.abs(hash) % 360}, 65%, 40%)`; 
    }

    function updateStats(tasks) {
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'done').length;
        const review = tasks.filter(t => t.status === 'in_review').length;
        
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

        // Role-based moves
        if (currentUserRole === 'dev') {
            if (task.status === 'todo') { nextStatus = 'in_progress'; moveText = 'Start Progress →'; }
            else if (task.status === 'in_progress') { nextStatus = 'in_review'; moveText = 'Ask for Review 🔍'; }
        } else if (currentUserRole === 'lead') {
            if (task.status === 'in_review') { nextStatus = 'done'; moveText = 'Verify & Complete ✓'; }
        }

        card.innerHTML = `
            <div class="task-header">
                <span class="badge" style="background-color: ${catColor}; color: white; border: 1px solid rgba(255,255,255,0.2);">${task.category || 'General'}</span>
                <div style="display: flex; gap: 5px;">
                    <span class="badge ${priorityColor}">${task.priority}</span>
                    <button class="btn-delete-task" data-id="${task.id}" style="width: auto; padding: 0 4px; font-size: 0.7rem; background: transparent; border: 1px solid var(--error-color); color: var(--error-color); cursor: pointer; border-radius: 3px;" title="Delete Task">✕</button>
                </div>
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
            moveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                updateTaskStatus(task.id, nextStatus);
            });
        }

        const deleteBtn = card.querySelector('.btn-delete-task');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete task "${task.title}"?`)) {
                deleteTask(task.id);
            }
        });

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

    async function deleteTask(taskId) {
        try {
            const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
            if (res.ok) {
                loadTasks();
            } else {
                alert('Failed to delete task');
            }
        } catch (err) {
            console.error('Error deleting task:', err);
        }
    }

    // --- Modals and Forms ---

    fabNewProject.addEventListener('click', () => { projectModal.hidden = false; });
    cancelProjectBtn.addEventListener('click', () => { projectModal.hidden = true; newProjectForm.reset(); });
    projectModal.addEventListener('click', (e) => {
        if (e.target === projectModal) { projectModal.hidden = true; newProjectForm.reset(); }
    });

    newProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedOptions = Array.from(document.getElementById('projectAssignee').selectedOptions);
        const assignedIds = selectedOptions.map(opt => parseInt(opt.value));
        
        const newProject = {
            name: document.getElementById('projectName').value,
            description: document.getElementById('projectDesc').value,
            assigned_to: assignedIds 
        };

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject)
            });

            if (res.ok) {
                projectModal.hidden = true;
                newProjectForm.reset();
                loadProjects(); 
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create project');
            }
        } catch (err) {
            console.error('Network error:', err);
        }
    });

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
            project_id: currentProjectId,
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