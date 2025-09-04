// Theme management
let currentTheme = 'blue';
const themes = ['blue', 'purple', 'orange'];

function toggleTheme() {
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    currentTheme = themes[nextIndex];
    
    // Apply theme to body
    document.body.setAttribute('data-theme', currentTheme === 'blue' ? '' : currentTheme);
    
    // Save theme preference
    localStorage.setItem('portfolioTheme', currentTheme);
}

// Load saved theme on page load
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('portfolioTheme');
    if (savedTheme && themes.includes(savedTheme)) {
        currentTheme = savedTheme;
        document.body.setAttribute('data-theme', currentTheme === 'blue' ? '' : currentTheme);
    }
}

// Generate animated stars
function createStars() {
    const starsContainer = document.getElementById('stars');
    const numStars = 150;

    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = (Math.random() * 3 + 2) + 's';
        starsContainer.appendChild(star);
    }
}

// Generate floating particles
function createParticles() {
    const numParticles = 20;
    
    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
        document.body.appendChild(particle);
    }
}

// Page navigation
function showPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
    
    // Close mobile menu if open
    document.getElementById('navLinks').classList.remove('active');
}

// Mobile menu toggle
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('active');
}

// Smooth scroll and navigation effects
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.style.background = 'rgba(0, 0, 0, 0.7)';
    } else {
        nav.style.background = 'rgba(0, 0, 0, 0.3)';
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    createStars();
    createParticles();
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    const nav = document.querySelector('nav');
    const navLinks = document.getElementById('navLinks');
    
    if (!nav.contains(e.target)) {
        navLinks.classList.remove('active');
    }
});