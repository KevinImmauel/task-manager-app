const app = require('./app');

const PORT = process.env.PORT || 3000;

// You would typically initialize your SQLite database connection here as well

app.listen(PORT, () => {
    console.log(`Server is actively running on port ${PORT}`);
});