// Main Application Logic for PadPick

// Beautiful placeholder images from Unsplash to cycle through when no image is provided
const PLACEHOLDER_IMAGES = [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=600&q=80"
];

let currentUser = null;
let allProperties = [];
let watchlist = JSON.parse(localStorage.getItem("padpick_watchlist")) || [];
let isEditMode = false;
let editPropertyId = null;
let chatRefreshInterval = null;
let activeChatIdToOpen = null;

// Mock Chat Conversations data
let mockChats = [
    {
        id: 1,
        name: "David (Malibu Villa Owner)",
        preview: "Great, let's schedule a viewing for this Saturday.",
        status: "Active Landlord",
        isMock: true,
        messages: [
            { sender: "incoming", text: "Hello! Thanks for your interest in my Malibu beachfront villa." },
            { sender: "outgoing", text: "Hi David, the villa looks amazing. Is the price negotiable for a 12-month lease?" },
            { sender: "incoming", text: "I could offer a $500/month discount if we sign a 2-year lease. Let me know what you think." },
            { sender: "outgoing", text: "That sounds reasonable! When are you free for a viewing?" },
            { sender: "incoming", text: "Great, let's schedule a viewing for this Saturday." }
        ]
    },
    {
        id: 2,
        name: "Sarah (Kensington Townhouse)",
        preview: "Yes, pets are allowed, but with an extra security deposit.",
        status: "Landlord",
        isMock: true,
        messages: [
            { sender: "incoming", text: "Hi! The Victorian townhouse is currently available." },
            { sender: "outgoing", text: "Hello! Quick question - do you allow pets in the property?" },
            { sender: "incoming", text: "Yes, pets are allowed, but with an extra security deposit." }
        ]
    },
    {
        id: 3,
        name: "Kenji (Shibuya Studio)",
        preview: "The studio has high-speed internet pre-installed.",
        status: "Verified Landlord",
        isMock: true,
        messages: [
            { sender: "incoming", text: "Hello! The Shibuya studio is perfect for students or remote workers." },
            { sender: "outgoing", text: "Awesome. How is the internet speed there?" },
            { sender: "incoming", text: "The studio has high-speed internet pre-installed." }
        ]
    }
];

// Initialize on load
document.addEventListener("DOMContentLoaded", async () => {
    // Restore sidebar collapse preference immediately to avoid layout flicker
    const savedSidebarState = localStorage.getItem("padpick_sidebar_collapsed");
    const sidebarElement = document.querySelector(".sidebar");
    if (savedSidebarState === "true" && sidebarElement) {
        sidebarElement.classList.add("collapsed");
    }

    // Check User Authentication state
    currentUser = await getProfile();
    
    // Protect dashboard page: if not logged in, redirect to login
    if (!currentUser) {
        showToast("You must log in to view the dashboard.", "error");
        setTimeout(() => {
            window.location.href = "./login.html";
        }, 1200);
        return;
    }

    updateNavbarState();
    
    // Fetch and display properties
    await fetchProperties();

    // Hook up sidebar menu controls
    initSidebarMenu();

    // Hook up event listeners
    initEventListeners();

    // Initialize Hash Routing
    window.addEventListener("hashchange", handleHashRouting);
    handleHashRouting();
});

// Update navigation actions based on auth state
function updateNavbarState() {
    const topNavUsername = document.getElementById("top-nav-username");
    const sidebarProfileBox = document.getElementById("sidebar-profile-box");
    const addListingBtn = document.getElementById("add-listing-btn");
    
    if (currentUser) {
        const displayName = currentUser.full_name || currentUser.email.split('@')[0];
        const avatarHtml = currentUser.avatar_url 
            ? `<img src="${API_BASE}${currentUser.avatar_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
            : displayName.substring(0, 2).toUpperCase();
        
        // In top nav
        if (topNavUsername) {
            topNavUsername.innerHTML = `Welcome to PadPick, <span>${displayName}</span>`;
        }
        
        // In sidebar footer
        if (sidebarProfileBox) {
            sidebarProfileBox.innerHTML = `
                <div class="user-profile" style="gap: 0.8rem;">
                    <div class="chat-item-avatar" style="width: 36px; height: 36px; font-size: 0.9rem; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--border-color);">
                        ${avatarHtml}
                    </div>
                    <div style="min-width: 0;">
                        <div style="font-weight: 700; font-size: 0.88rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentUser.email}</div>
                    </div>
                </div>
            `;
        }
        
        // Show "List Your Home" button
        if (addListingBtn) addListingBtn.style.display = "inline-flex";
    }
}

// Get fallback image based on property ID so it is consistent
function getPropertyImage(imageUrl, id) {
    if (imageUrl && (imageUrl.trim().startsWith("http") || imageUrl.trim().startsWith("/"))) {
        return imageUrl;
    }
    // Select deterministic image based on ID
    const index = (id || 0) % PLACEHOLDER_IMAGES.length;
    return PLACEHOLDER_IMAGES[index];
}

// Fetch properties from backend API
async function fetchProperties(filters = {}) {
    const grid = document.getElementById("properties-grid");
    if (!grid) return;
    
    grid.innerHTML = '<div class="empty-state"><h3>Loading rentals...</h3></div>';

    try {
        let url = `${API_BASE}/api/properties`;
        const params = new URLSearchParams();
        
        if (filters.location) params.append("location", filters.location);
        if (filters.max_price) params.append("max_price", filters.max_price);
        if (filters.bedrooms) params.append("bedrooms", filters.bedrooms);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error("Could not fetch properties");
        
        allProperties = await response.json();
        renderProperties(allProperties, "properties-grid");
    } catch (error) {
        console.error("Error loading properties:", error);
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <h3>Failed to load properties</h3>
                <p>Please check your server connection and database setup.</p>
            </div>
        `;
    }
}

// Render properties list to a targeted grid
function renderProperties(properties, targetGridId) {
    const grid = document.getElementById(targetGridId);
    if (!grid) return;
    
    let displayProperties = properties;
    if (targetGridId === "properties-grid" && currentUser) {
        displayProperties = properties.filter(prop => prop.owner_id !== currentUser.id);
    }
    
    grid.innerHTML = "";
    
    if (displayProperties.length === 0) {
        if (targetGridId === "mylistings-grid") {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    <h3>You have no active listings</h3>
                    <p>Click the "List Your Home" button in the navigation to post your first rental property!</p>
                </div>
            `;
        } else if (targetGridId === "watchlist-grid") {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    <h3>Your watchlist is empty</h3>
                    <p>Browse listings on the Explore tab and click the heart icon to save your favorites!</p>
                </div>
            `;
        } else {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    <h3>No rental homes found</h3>
                    <p>There are no listings matching these requirements.</p>
                </div>
            `;
        }
        return;
    }

    displayProperties.forEach(prop => {
        const image = getPropertyImage(prop.image_url, prop.id);
        const isBookmarked = watchlist.includes(prop.id);
        const card = document.createElement("div");
        card.className = "property-card";
        card.style.position = "relative";
        card.setAttribute("onclick", `openPropertyDetails(${prop.id})`);
        
        // Furnished status badge
        const furnishedBadge = prop.furnished_status ? `<span class="card-badge-furnished">${prop.furnished_status}</span>` : '';
        
        // Amenities preview
        let amenitiesPreview = "";
        if (prop.amenities) {
            const list = prop.amenities.split(",").filter(a => a.trim()).slice(0, 3);
            if (list.length > 0) {
                amenitiesPreview = `<div class="card-amenities-preview">` + 
                    list.map(a => `<span class="card-amenity-dot">${a.trim()}</span>`).join("") + 
                    (prop.amenities.split(",").length > 3 ? `<span class="card-amenity-dot">+more</span>` : '') +
                    `</div>`;
            }
        }
        
        card.innerHTML = `
            <div class="property-image-container">
                <img class="property-img" src="${image}" alt="${prop.title}" loading="lazy">
                ${furnishedBadge}
                <!-- Bookmark Heart Icon -->
                <button class="property-bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="toggleWatchlist(event, ${prop.id})">
                    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </button>
                
                <span class="property-price-badge">$${prop.price_per_month.toLocaleString()}/mo</span>
            </div>
            <div class="property-content">
                <div class="property-location">${prop.location}</div>
                <h3 class="property-title">${prop.title}</h3>
                <p class="property-desc">${prop.description || 'No description provided.'}</p>
                
                ${amenitiesPreview}

                <div class="property-details" style="margin-top: 1rem;">
                    <div class="property-detail-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22v-3a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v3"></path><path d="M19 18V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v13"></path><line x1="9" y1="8" x2="15" y2="8"></line><line x1="9" y1="12" x2="15" y2="12"></line></svg>
                        <span>${prop.bedrooms} ${prop.bedrooms === 1 ? 'Bed' : 'Beds'}</span>
                    </div>
                    <div class="property-detail-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2z"></path><path d="M14 14h8v4a2 2 0 0 1-2 2h-6v-6z"></path><line x1="6" y1="8" x2="6" y2="8.01"></line></svg>
                        <span>${prop.bathrooms} ${prop.bathrooms === 1 ? 'Bath' : 'Baths'}</span>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Watchlist Toggling logic
function toggleWatchlist(event, propertyId) {
    event.stopPropagation();
    event.preventDefault();
    
    const index = watchlist.indexOf(propertyId);
    if (index > -1) {
        // Remove from watchlist
        watchlist.splice(index, 1);
        showToast("Removed from watchlist", "success");
    } else {
        // Add to watchlist
        watchlist.push(propertyId);
        showToast("Added to watchlist", "success");
    }
    
    // Save to localStorage
    localStorage.setItem("padpick_watchlist", JSON.stringify(watchlist));
    
    // Re-render currently active views to show status change
    const activeMenuItem = document.querySelector(".menu-item.active");
    const activeView = activeMenuItem ? activeMenuItem.getAttribute("data-view") : "explore";
    
    if (activeView === "explore") {
        renderProperties(allProperties, "properties-grid");
    } else if (activeView === "watchlist") {
        renderWatchlist();
    } else if (activeView === "mylistings") {
        renderMyListings();
    }
}

// Render Bookmarked properties
function renderWatchlist() {
    const bookmarkedProperties = allProperties.filter(prop => watchlist.includes(prop.id));
    renderProperties(bookmarkedProperties, "watchlist-grid");
}

// Render User's Own Listed Properties
function renderMyListings() {
    if (!currentUser) return;
    // We check if property owner_id equals current logged in user's id
    const myListings = allProperties.filter(prop => prop.owner_id === currentUser.id);
    renderProperties(myListings, "mylistings-grid");
}

// Render Profile Card details
// Render Profile Card details
async function renderProfile() {
    const profileBox = document.getElementById("profile-card-details");
    if (!profileBox || !currentUser) return;
    
    // Fetch user's review if any
    let myReview = null;
    try {
        const res = await fetch(`${API_BASE}/api/reviews/me`, {
            headers: getAuthHeaders()
        });
        if (res.ok) {
            myReview = await res.json();
        }
    } catch (err) {
        console.error("Failed to load user review status:", err);
    }
    
    const displayName = currentUser.full_name || "N/A";
    const userInitials = displayName.substring(0, 2).toUpperCase();
    const joinedDate = currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A";
    
    const avatarContent = currentUser.avatar_url 
        ? `<img src="${API_BASE}${currentUser.avatar_url}" alt="Profile Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
        : userInitials;
        
    let reviewWidgetHtml = "";
    if (myReview) {
        reviewWidgetHtml = `
            <div class="profile-review-section" style="width: 100%; text-align: left; max-width: 500px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--radius-md);">
                <h3 style="color: white; margin-bottom: 0.5rem; font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                    <span>✨</span> Your PadPick Review
                </h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem; line-height: 1.4;">
                    You have already submitted your feedback. Thank you for helping us improve PadPick!
                </p>
                <div style="display: flex; gap: 0.25rem; font-size: 1.5rem; color: #fbbf24; margin-bottom: 0.75rem;">
                    ${"★".repeat(myReview.rating)}${"☆".repeat(5 - myReview.rating)}
                </div>
                <div style="background: rgba(8, 11, 17, 0.4); border-left: 3px solid var(--primary); padding: 0.8rem 1rem; border-radius: 4px; font-size: 0.92rem; color: #f3f4f6; font-style: italic; line-height: 1.5;">
                    "${myReview.feedback}"
                </div>
            </div>
        `;
    } else {
        reviewWidgetHtml = `
            <div class="profile-review-section" style="width: 100%; text-align: left; max-width: 500px; margin: 0 auto;">
                <h3 style="color: white; margin-bottom: 0.5rem; font-size: 1.2rem; font-weight: 700;">Rate & Review PadPick</h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.2rem; line-height: 1.4;">
                    Let us know what you think of our website! Your rating and feedback will be featured live on our homepage.
                </p>
                
                <form id="website-review-form" onsubmit="submitWebsiteReview(event)" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label" style="margin-bottom: 0.5rem; display: block;">Your Rating</label>
                        <div class="star-rating-input" style="display: flex; gap: 0.5rem; align-items: center;">
                            ${[1, 2, 3, 4, 5].map(star => `
                                <span class="star-item" data-value="${star}" onclick="setReviewRating(${star})" style="font-size: 2rem; cursor: pointer; color: #4b5563; transition: color 0.15s ease, transform 0.1s ease; line-height: 1;">★</span>
                            `).join("")}
                        </div>
                        <input type="hidden" id="review-rating-value" value="0" required>
                    </div>
                    <div class="form-group">
                        <label for="review-feedback" class="form-label" style="margin-bottom: 0.5rem; display: block;">Feedback Message</label>
                        <textarea id="review-feedback" class="input-control" rows="3" placeholder="I love using PadPick to find modern listings..." required style="resize: none;"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; height: 44px; font-weight: 600;">
                        Submit Review
                    </button>
                </form>
            </div>
        `;
    }
        
    profileBox.innerHTML = `
        <div class="profile-avatar-container">
            <div class="profile-avatar" id="profile-avatar-click" onclick="document.getElementById('profile-upload-file').click()" style="cursor: pointer; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--border-color);" title="Click to upload profile photo">
                ${avatarContent}
                <div class="avatar-hover-overlay" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.6); color: white; font-size: 0.7rem; padding: 0.2rem 0; text-align: center; font-weight: 600;">Edit</div>
            </div>
            <input type="file" id="profile-upload-file" accept="image/*" style="display: none;" onchange="uploadProfileImage(event)">
            <div style="font-weight: 800; font-size: 1.25rem; color: white; margin-top: 0.5rem;">${displayName}</div>
            <div style="color: var(--accent); font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Verified Account</div>
        </div>
        <div class="profile-info-grid">
            <div class="profile-info-item">
                <div class="profile-info-label">Full Name</div>
                <div class="profile-info-value">${displayName}</div>
            </div>
            <div class="profile-info-item">
                <div class="profile-info-label">Email Address</div>
                <div class="profile-info-value">${currentUser.email}</div>
            </div>
            <div class="profile-info-item">
                <div class="profile-info-label">Mobile Number</div>
                <div class="profile-info-value">${currentUser.mobile_number || "Not provided"}</div>
            </div>
            <div class="profile-info-item">
                <div class="profile-info-label">Member Since</div>
                <div class="profile-info-value">${joinedDate}</div>
            </div>
        </div>
        
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 2.5rem 0 2rem 0; width: 100%;">
        
        ${reviewWidgetHtml}
    `;
}

// Upload profile photo using FormData
async function uploadProfileImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
        showToast("Please select a valid image file.", "error");
        return;
    }
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
        const token = localStorage.getItem("token");
        const headers = {};
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
        
        showToast("Uploading profile image...", "info");
        
        const response = await fetch(`${API_BASE}/api/users/profile-image`, {
            method: "POST",
            headers: headers,
            body: formData
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Failed to upload profile image");
        }
        
        const updatedUser = await response.json();
        currentUser = updatedUser;
        showToast("Profile image updated successfully!", "success");
        
        // Re-render profile page
        renderProfile();
        
        // Also update navbar state (if the nav profile box shows the avatar)
        updateNavbarState();
    } catch (error) {
        showToast(error.message, "error");
    }
}

// Select star rating value and highlight stars
function setReviewRating(rating) {
    const ratingInput = document.getElementById("review-rating-value");
    if (ratingInput) {
        ratingInput.value = rating;
    }
    
    const stars = document.querySelectorAll(".star-rating-input .star-item");
    stars.forEach(star => {
        const val = parseInt(star.getAttribute("data-value"));
        if (val <= rating) {
            star.style.color = "#fbbf24"; // Gold color
            star.style.transform = "scale(1.15)";
        } else {
            star.style.color = "#4b5563"; // Off gray
            star.style.transform = "scale(1.0)";
        }
    });
}

// Submit website feedback
async function submitWebsiteReview(event) {
    event.preventDefault();
    const ratingInput = document.getElementById("review-rating-value");
    const feedbackInput = document.getElementById("review-feedback");
    
    if (!ratingInput || !feedbackInput) return;
    
    const rating = parseInt(ratingInput.value);
    const feedback = feedbackInput.value.trim();
    
    if (rating === 0) {
        showToast("Please select a rating out of 5 stars.", "error");
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/reviews`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ rating, feedback })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Failed to submit review");
        }
        
        showToast("Thank you for your feedback!", "success");
        renderProfile();
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function loadRealChats(openActiveChatId = null) {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_BASE}/api/messages/chats`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error("Could not load chats");
        const realChatsData = await response.json();
        
        // Build keys of database chats to filter out duplicates from mockChats
        const dbKeys = new Set(realChatsData.map(c => `${c.other_user_id}_${c.property_id}`));
        const oldMockChats = [...mockChats];
        
        // Filter mockChats: keep mock chats (id <= 3) and any local unsaved chats
        mockChats = mockChats.filter(c => {
            if (c.id <= 3) return true;
            const key = `${c.ownerId}_${c.propertyId}`;
            return !dbKeys.has(key);
        });
        
        // Map database chats
        realChatsData.forEach((chatData, index) => {
            const key = `${chatData.other_user_id}_${chatData.property_id}`;
            const existing = oldMockChats.find(c => c.id > 3 && `${c.ownerId}_${c.propertyId}` === key);
            const chatId = existing ? existing.id : (200 + index);
            
            const chatObj = {
                id: chatId,
                ownerId: chatData.other_user_id,
                propertyId: chatData.property_id,
                name: `${chatData.other_user_name} (${chatData.property_title || 'Chat'})`,
                preview: chatData.last_message,
                status: "Property Owner",
                contactNumber: chatData.contact_number || "+1 (555) 019-2834",
                messages: chatData.messages.map(m => ({
                    sender: m.sender_id === currentUser.id ? "outgoing" : "incoming",
                    text: m.text
                }))
            };
            mockChats.push(chatObj);
        });
        
        renderChatsList();
        
        // If we are looking at an active chat, let's keep it highlighted and update its bubbles
        const activeItem = document.querySelector(".chat-item.active");
        if (activeItem) {
            const activeChatId = parseInt(activeItem.id.replace("chat-item-", ""));
            const currentChatObj = mockChats.find(c => c.id === activeChatId);
            if (currentChatObj) {
                const itemEl = document.getElementById(`chat-item-${activeChatId}`);
                if (itemEl) itemEl.classList.add("active");
                renderMessageBubbles(currentChatObj.messages);
            }
        } else if (openActiveChatId !== null) {
            openChat(openActiveChatId);
        }
    } catch (err) {
        console.error("Error loading real chats:", err);
    }
}

// Initialize messaging tab UI & mock events
async function initMessages(openChatId = null) {
    await loadRealChats(openChatId);
    
    // Bind search text filtering
    const searchInput = document.getElementById("chat-search-input");
    if (searchInput) {
        // Clear previous value
        searchInput.value = "";
        searchInput.removeEventListener("input", handleChatSearch);
        searchInput.addEventListener("input", handleChatSearch);
    }
    
    // Open the first chat by default if no active chat was opened by loadRealChats
    const activeItem = document.querySelector(".chat-item.active");
    if (!activeItem && mockChats.length > 0) {
        openChat(mockChats[0].id);
    }
}

function handleChatSearch(e) {
    renderChatsList(e.target.value);
}

function renderChatsList(filterQuery = "") {
    const listContainer = document.getElementById("chats-list");
    if (!listContainer) return;
    
    listContainer.innerHTML = "";
    
    const query = filterQuery.toLowerCase().trim();
    const filteredChats = mockChats.filter(chat => {
        if (!query) return true;
        return chat.name.toLowerCase().includes(query) || 
               (chat.preview && chat.preview.toLowerCase().includes(query));
    });
    
    if (filteredChats.length === 0) {
        listContainer.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">No chats found</div>`;
        return;
    }
    
    // Re-highlight active class based on UI selection if applicable
    const activeItem = document.querySelector(".chat-item.active");
    const activeId = activeItem ? parseInt(activeItem.id.replace("chat-item-", "")) : null;
    
    filteredChats.forEach(chat => {
        const initials = chat.name.substring(0, 2).toUpperCase();
        const item = document.createElement("li");
        item.className = "chat-item";
        item.id = `chat-item-${chat.id}`;
        if (activeId === chat.id) {
            item.className += " active";
        }
        item.onclick = () => openChat(chat.id);
        
        // Green active dot for David, Kenji, and all real db chats
        const isOnline = chat.id === 1 || chat.id === 3 || chat.id >= 100;
        const onlineDot = isOnline ? `<span class="status-indicator online"></span>` : ``;
        
        item.innerHTML = `
            <div style="position: relative;">
                <div class="chat-item-avatar">${initials}</div>
                ${onlineDot}
            </div>
            <div class="chat-item-details">
                <div class="chat-item-name">${chat.name}</div>
                <div class="chat-item-preview" id="chat-preview-${chat.id}">${chat.preview || 'No messages yet'}</div>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function openChat(chatId) {
    const chat = mockChats.find(c => c.id === chatId);
    if (!chat) return;
    
    // Add chat-active class to messages container for mobile column toggle
    const container = document.querySelector(".messages-container");
    if (container) {
        container.classList.add("chat-active");
    }
    
    // Update active class in list
    document.querySelectorAll(".chat-item").forEach(item => item.classList.remove("active"));
    const selectedItem = document.getElementById(`chat-item-${chat.id}`);
    if (selectedItem) selectedItem.classList.add("active");
    
    const windowContainer = document.getElementById("chat-window");
    if (!windowContainer) return;
    
    const initials = chat.name.substring(0, 2).toUpperCase();
    
    windowContainer.innerHTML = `
        <div class="chat-window-header">
            <button class="btn btn-secondary mobile-back-btn" onclick="document.querySelector('.messages-container').classList.remove('chat-active')" style="display: none; padding: 0 0.8rem; height: 36px; font-size: 0.85rem; margin-right: 0.8rem; align-items: center; justify-content: center; border-color: var(--border-color); color: var(--text-secondary); background: transparent; border-radius: var(--radius-sm);">❮ Back</button>
            <div class="chat-window-avatar">${initials}</div>
            <div style="min-width: 0; flex: 1;">
                <div class="chat-window-name">${chat.name}</div>
                <div class="chat-window-status">${chat.status}</div>
            </div>
        </div>
        
        <div class="chat-messages-list" id="chat-messages-list">
            <!-- Messages bubbles loaded here -->
        </div>
        
        <form id="chat-input-form" class="chat-input-area" onsubmit="sendChatMessage(event, ${chat.id})">
            <input type="text" id="chat-input-field" class="input-control" placeholder="Type a message to landlord..." required autocomplete="off">
            <button type="submit" class="btn btn-primary" style="padding: 0 1.5rem; height: 48px;">Send</button>
        </form>
    `;
    
    // Render messages bubbles
    renderMessageBubbles(chat.messages);
}

function renderMessageBubbles(messages) {
    const list = document.getElementById("chat-messages-list");
    if (!list) return;
    
    list.innerHTML = "";
    messages.forEach(msg => {
        const bubble = document.createElement("div");
        bubble.className = `message-bubble ${msg.sender}`;
        
        // If message contains call request mobile number, render with a copy button
        if (msg.text.includes("mobile number:")) {
            const match = msg.text.match(/mobile number:\s*([^\s\.]+)/);
            const phoneNumber = match ? match[1].trim() : "";
            
            bubble.innerHTML = `
                <div>${msg.text}</div>
                ${phoneNumber ? `
                    <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${phoneNumber}'); showToast('Number copied to clipboard!', 'success');" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; gap: 0.2rem; border-color: rgba(255,255,255,0.2);">
                        📋 Copy Number
                    </button>
                ` : ''}
            `;
        } else {
            bubble.innerText = msg.text;
        }
        list.appendChild(bubble);
    });
    
    // Auto-scroll messages list to the bottom
    list.scrollTop = list.scrollHeight;
}

async function sendChatMessage(event, chatId) {
    event.preventDefault();
    const inputField = document.getElementById("chat-input-field");
    if (!inputField) return;
    
    const text = inputField.value.trim();
    if (!text) return;
    
    const chat = mockChats.find(c => c.id === chatId);
    if (!chat) return;
    
    inputField.value = "";

    if (chatId >= 100) {
        // Database-backed peer-to-peer message
        try {
            const response = await fetch(`${API_BASE}/api/messages`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    receiver_id: chat.ownerId,
                    property_id: chat.propertyId,
                    text: text
                })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Failed to send message to database");
            }
            
            // Reload chats from database
            await loadRealChats();
            
            // Re-open the chat conversation room (find by ownerId and propertyId as indexes may shift)
            const updatedChat = mockChats.find(c => c.ownerId === chat.ownerId && c.propertyId === chat.propertyId);
            if (updatedChat) {
                openChat(updatedChat.id);
            }
        } catch (err) {
            showToast(err.message, "error");
        }
    } else {
        // Local mock chat behavior
        chat.messages.push({ sender: "outgoing", text: text });
        chat.preview = text; // Update preview text
        
        // Re-render bubbles
        renderMessageBubbles(chat.messages);
        
        // Update preview in left sidebar
        const previewEl = document.getElementById(`chat-preview-${chat.id}`);
        if (previewEl) previewEl.innerText = text;
        
        // Keep track of user message count for this chat to cycle generic flow
        if (!chat.userMessageCount) {
            chat.userMessageCount = 0;
        }
        chat.userMessageCount++;

        // Trigger mock landlord auto-response in 1.5 seconds only for mock landlords
        if (chat.isMock || chat.id <= 3) {
            setTimeout(() => {
                const responseText = getLandlordResponse(text, chat.userMessageCount);
                
                chat.messages.push({ sender: "incoming", text: responseText });
                chat.preview = responseText;
                
                // If they are still looking at this chat window
                const activeItem = document.querySelector(".chat-item.active");
                if (activeItem && activeItem.id === `chat-item-${chatId}`) {
                    renderMessageBubbles(chat.messages);
                }
                
                // Update left preview
                if (previewEl) previewEl.innerText = responseText;
            }, 1500);
        }
    }
}

// Advanced long-chat conversational auto-responder
function getLandlordResponse(userInput, messageCount) {
    const input = userInput.toLowerCase();
    
    if (input.includes("price") || input.includes("rent") || input.includes("negotiate") || input.includes("cost") || input.includes("how much")) {
        return "The rent is as listed, but I might consider a 5% discount for a lease of 18 months or longer. What lease term were you looking for?";
    }
    if (input.includes("pet") || input.includes("dog") || input.includes("cat")) {
        return "Pets are generally allowed, but we require a $250 pet deposit and a quick description of the breed/size. Do you have a pet?";
    }
    if (input.includes("visit") || input.includes("view") || input.includes("show") || input.includes("see")) {
        return "I can arrange viewings on Wednesday afternoons and all day Saturdays. Would any of those times work for you?";
    }
    if (input.includes("furnished") || input.includes("furniture")) {
        return "The property comes exactly as shown. If you prefer un-furnished, I can arrange to store some furniture, but the rent price will stay the same.";
    }
    if (input.includes("utility") || input.includes("bills") || input.includes("electric") || input.includes("water")) {
        return "Water and trash collection are included in the rent. You will be responsible for electricity, gas, and internet. Does that sound fair?";
    }
    if (input.includes("deposit") || input.includes("advance")) {
        return "We require one month's rent as a security deposit, along with the first month's rent upon signing the lease agreement.";
    }
    if (input.includes("hello") || input.includes("hi") || input.includes("hey")) {
        return "Hello! I am happy to chat about the property. Ask me anything about the location, amenities, or viewings!";
    }
    
    // Conversational flow based on message count
    const genericFlow = [
        "That sounds interesting! Could you tell me a bit more about your move-in timeline?",
        "Thanks for the details. I want to make sure we find the right fit. Are you moving in alone or with family?",
        "Got it. I'll check with my current tenant about scheduling. Is there anything else about the house you'd like to know?",
        "Perfect. Let's stay in touch. I will compile the application form and send it over.",
        "I appreciate your interest! I'm happy to answer any other questions you might have.",
        "Sounds great, looking forward to connecting soon!",
        "I'll check the calendar and confirm our schedule tomorrow.",
        "Excellent, let's keep in touch! Let me know if you need anything else."
    ];
    
    const index = messageCount % genericFlow.length;
    return genericFlow[index];
}

// Sidebar Menu items selector logic
function initSidebarMenu() {
    const menuItems = document.querySelectorAll(".menu-item");
    
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetView = item.getAttribute("data-view");
            
            if (targetView === "filter") {
                window.location.hash = "filter";
            } else {
                window.location.hash = targetView;
            }
        });
    });
}

function handleHashRouting() {
    let viewName = window.location.hash.substring(1) || "explore";
    const validViews = ["explore", "watchlist", "mylistings", "messages", "profile"];
    
    if (viewName === "filter") {
        window.location.hash = "explore";
        focusFilters();
        return;
    }
    
    if (!validViews.includes(viewName)) {
        viewName = "explore";
    }
    
    // Update active class in menu
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(mi => {
        if (mi.getAttribute("data-view") === viewName) {
            mi.classList.add("active");
        } else {
            mi.classList.remove("active");
        }
    });
    
    switchDashboardView(viewName);
}

function focusFilters() {
    // Focus / scroll to filter container
    const filterForm = document.getElementById("filter-form");
    if (filterForm) {
        filterForm.scrollIntoView({ behavior: "smooth" });
        // Flash the filters container
        const container = document.querySelector(".filters-container");
        if (container) {
            container.style.borderColor = "var(--primary)";
            setTimeout(() => {
                container.style.borderColor = "var(--border-color)";
            }, 1000);
        }
    }
}

function switchDashboardView(viewName) {
    // Hide all views
    document.querySelectorAll(".dashboard-view").forEach(view => {
        view.classList.remove("active");
    });
    
    // Clear chat polling if we navigate away from messages view
    if (chatRefreshInterval) {
        clearInterval(chatRefreshInterval);
        chatRefreshInterval = null;
    }
    
    // Activate target view
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.add("active");
    }
    
    // Trigger specific rendering/loading behaviors per view type
    if (viewName === "explore") {
        renderProperties(allProperties, "properties-grid");
    } else if (viewName === "watchlist") {
        renderWatchlist();
    } else if (viewName === "mylistings") {
        renderMyListings();
    } else if (viewName === "messages") {
        initMessages(activeChatIdToOpen);
        activeChatIdToOpen = null; // Reset
        // Start polling for new messages every 5 seconds
        chatRefreshInterval = setInterval(async () => {
            await loadRealChats();
        }, 5000);
    } else if (viewName === "profile") {
        renderProfile();
    }
}

function updateMediaInputRemoveButtons() {
    const mediaContainer = document.getElementById("media-inputs-container");
    if (!mediaContainer) return;
    const items = mediaContainer.querySelectorAll(".media-input-item");
    const count = items.length;
    items.forEach(item => {
        const btn = item.querySelector(".media-remove-btn");
        if (btn) {
            if (count <= 1) {
                btn.disabled = true;
                btn.style.opacity = "0.5";
                btn.style.cursor = "not-allowed";
            } else {
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
            }
        }
    });
}

// Hook up all interface event listeners
function initEventListeners() {
    // Sidebar Collapse Toggle
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            localStorage.setItem("padpick_sidebar_collapsed", sidebar.classList.contains("collapsed"));
        });
    }

    // 1. Search Filters Form
    const filterForm = document.getElementById("filter-form");
    if (filterForm) {
        filterForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const location = document.getElementById("filter-location").value.trim();
            const max_price = document.getElementById("filter-price").value;
            const bedrooms = document.getElementById("filter-bedrooms").value;
            
            await fetchProperties({
                location: location || undefined,
                max_price: max_price || undefined,
                bedrooms: bedrooms || undefined
            });
        });
    }

    // 2. Modal interactions
    const addListingBtn = document.getElementById("add-listing-btn");
    const propertyModal = document.getElementById("property-modal");
    const modalCloseBtn = document.getElementById("modal-close-btn");
    const propertyForm = document.getElementById("property-form");

    // Dynamic Media Inputs handlers
    const addMediaBtn = document.getElementById("add-media-input-btn");
    const mediaContainer = document.getElementById("media-inputs-container");



    if (addMediaBtn && mediaContainer) {
        addMediaBtn.addEventListener("click", () => {
            const currentCount = mediaContainer.querySelectorAll(".media-input-item").length;
            if (currentCount >= 15) {
                showToast("You can upload a maximum of 15 media URLs.", "error");
                return;
            }
            
            const newItem = document.createElement("div");
            newItem.className = "media-input-item";
            newItem.style.display = "flex";
            newItem.style.gap = "0.5rem";
            newItem.style.alignItems = "center";
            newItem.style.marginTop = "0.25rem";
            
            newItem.innerHTML = `
                <input type="url" class="input-control media-url-field" placeholder="https://images.unsplash.com/photo-..." required>
                <button type="button" class="btn btn-secondary media-remove-btn" style="padding: 0.8rem;">✕</button>
            `;
            
            const removeBtn = newItem.querySelector(".media-remove-btn");
            removeBtn.addEventListener("click", () => {
                newItem.remove();
                updateMediaInputRemoveButtons();
            });
            
            mediaContainer.appendChild(newItem);
            updateMediaInputRemoveButtons();
        });
    }

    const resetFormToInitialState = () => {
        if (propertyForm) propertyForm.reset();
        const mediaUrlsInput = document.getElementById("prop-media-urls");
        const previewContainer = document.getElementById("prop-media-preview-container");
        if (mediaUrlsInput) mediaUrlsInput.value = "";
        if (previewContainer) previewContainer.innerHTML = "";
        
        // Reset edit states to prevent leakage
        isEditMode = false;
        editPropertyId = null;
        
        // Reset modal title and button labels
        if (propertyModal) {
            const titleEl = propertyModal.querySelector(".modal-title");
            if (titleEl) titleEl.innerText = "List a New Rental Home";
            
            const submitEl = propertyModal.querySelector('button[type="submit"]');
            if (submitEl) submitEl.innerText = "Submit Listing";
        }
    };

    const propImagesUpload = document.getElementById("prop-images-upload");
    if (propImagesUpload) {
        propImagesUpload.addEventListener("change", async (event) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;
            
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append("files", files[i]);
            }
            
            showToast("Uploading property images...", "info");
            
            try {
                const response = await fetch(`${API_BASE}/api/properties/upload-images`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${localStorage.getItem("token")}`
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || "Failed to upload images");
                }
                
                const data = await response.json();
                showToast("Images uploaded successfully!", "success");
                
                // Append new URLs to existing list
                const mediaUrlsInput = document.getElementById("prop-media-urls");
                let urls = [];
                if (mediaUrlsInput && mediaUrlsInput.value) {
                    urls = mediaUrlsInput.value.split(",").map(u => u.trim()).filter(u => u.length > 0);
                }
                urls = urls.concat(data.urls);
                
                renderPropertyUploadPreviews(urls);
                propImagesUpload.value = ""; // Reset file input
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }

    if (addListingBtn && propertyModal) {
        addListingBtn.addEventListener("click", () => {
            if (!currentUser) {
                showToast("You must log in to list a home.", "error");
                return;
            }
            isEditMode = false;
            editPropertyId = null;
            
            const titleEl = propertyModal.querySelector(".modal-title");
            if (titleEl) titleEl.innerText = "List a New Rental Home";
            
            const submitEl = propertyModal.querySelector('button[type="submit"]');
            if (submitEl) submitEl.innerText = "Submit Listing";
            
            resetFormToInitialState();
            propertyModal.classList.add("active");
        });
    }

    if (modalCloseBtn && propertyModal) {
        modalCloseBtn.addEventListener("click", () => {
            propertyModal.classList.remove("active");
            resetFormToInitialState();
        });

        // Click outside content to close
        propertyModal.addEventListener("click", (e) => {
            if (e.target === propertyModal) {
                propertyModal.classList.remove("active");
                resetFormToInitialState();
            }
        });
    }

    // 3. Create Property form submit
    if (propertyForm) {
        propertyForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const title = document.getElementById("prop-title").value.trim();
            const description = document.getElementById("prop-desc").value.trim();
            const price_per_month = parseFloat(document.getElementById("prop-price").value);
            const location = document.getElementById("prop-location").value.trim();
            const bedrooms = parseInt(document.getElementById("prop-bedrooms").value);
            const bathrooms = parseInt(document.getElementById("prop-bathrooms").value);
            
            const owner_name = document.getElementById("prop-owner").value.trim();
            const contact_number = document.getElementById("prop-contact").value.trim();
            const furnished_status = document.getElementById("prop-furnished").value;
            const address = document.getElementById("prop-address").value.trim();
            
            // Gather checkboxes
            const selectedAmenities = [];
            const checkboxes = propertyForm.querySelectorAll('input[name="amenity"]:checked');
            checkboxes.forEach(cb => selectedAmenities.push(cb.value));
            const amenities = selectedAmenities.join(",");
            
            // Gather media URLs
            const media_urls = document.getElementById("prop-media-urls").value.trim();
            if (!media_urls) {
                showToast("Please upload at least one home image.", "error");
                return;
            }

            try {
                const url = isEditMode ? `${API_BASE}/api/properties/${editPropertyId}` : `${API_BASE}/api/properties`;
                const method = isEditMode ? "PUT" : "POST";
                
                const response = await fetch(url, {
                    method: method,
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        title,
                        description,
                        price_per_month,
                        location,
                        bedrooms,
                        bathrooms,
                        owner_name,
                        contact_number,
                        furnished_status,
                        address,
                        amenities,
                        media_urls
                    })
                });

                const text = await response.text();
                let data = {};
                if (text) {
                    try {
                        data = JSON.parse(text);
                    } catch (err) {
                        throw new Error("Invalid server response format");
                    }
                }

                if (!response.ok) {
                    throw new Error(data.detail || `Failed to ${isEditMode ? 'update' : 'create'} property listing`);
                }

                showToast(isEditMode ? "Listing updated successfully!" : "Listing created successfully!", "success");
                propertyModal.classList.remove("active");
                resetFormToInitialState();
                
                // Reload listings
                await fetchProperties();
                
                // If on mylistings view, reload mylistings grid
                const activeMenuItem = document.querySelector(".menu-item.active");
                if (activeMenuItem && activeMenuItem.getAttribute("data-view") === "mylistings") {
                    renderMyListings();
                }
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    }

    // 4. Detail Modal interactions
    const detailModal = document.getElementById("property-detail-modal");
    const detailCloseBtn = document.getElementById("detail-modal-close-btn");
    
    if (detailCloseBtn && detailModal) {
        detailCloseBtn.addEventListener("click", closePropertyDetails);
        detailModal.addEventListener("click", (e) => {
            if (e.target === detailModal) {
                closePropertyDetails();
            }
        });
    }
}

// ==========================================================================
// 🖼️ CAROUSEL SLIDER & PROPERTY DETAILS VIEWER
// ==========================================================================
let currentCarouselIndex = 0;
let carouselMediaCount = 0;

function openPropertyDetails(propertyId) {
    const prop = allProperties.find(p => p.id === propertyId);
    if (!prop) return;
    
    const modal = document.getElementById("property-detail-modal");
    const body = document.getElementById("property-detail-body");
    if (!modal || !body) return;
    
    // Determine buttons based on ownership
    const isOwner = currentUser && prop.owner_id === currentUser.id;
    let actionsHtml = "";
    if (isOwner) {
        actionsHtml = `
            <div class="detail-actions-footer">
                <button class="btn btn-primary" onclick="openEditPropertyModal(${prop.id})">
                    ✏️ Edit Listing
                </button>
                <button class="btn" onclick="triggerDeleteProperty(${prop.id})" style="background: #ef4444; border-color: #ef4444; color: white;">
                    🗑️ Delete Listing
                </button>
            </div>
        `;
    } else {
        actionsHtml = `
            <div class="detail-actions-footer">
                <button class="btn btn-primary" onclick="startOwnerChat(${prop.id})">
                    💬 Message Owner
                </button>
                <button class="btn btn-accent" onclick="triggerCallSimulation(${prop.id})">
                    📞 Call Owner
                </button>
            </div>
        `;
    }

    // Parse media urls
    let mediaList = [];
    if (prop.media_urls) {
        mediaList = prop.media_urls.split(",").map(url => url.trim()).filter(url => url.length > 0);
    }
    
    // If empty list, use standard preview
    if (mediaList.length === 0) {
        mediaList = [getPropertyImage(prop.image_url, prop.id)];
    }
    
    carouselMediaCount = mediaList.length;
    currentCarouselIndex = 0;
    
    // Generate carousel HTML
    let slidesHtml = "";
    mediaList.forEach(url => {
        const isVideo = url.endsWith(".mp4") || url.endsWith(".mov") || url.endsWith(".webm") || url.includes("/video") || url.includes("video_");
        slidesHtml += `
            <div class="carousel-slide">
                ${isVideo ? `<video src="${url}" controls autoplay muted playsinline></video>` : `<img src="${url}" alt="Property Media" loading="lazy">`}
            </div>
        `;
    });
    
    const showArrows = mediaList.length > 1;
    const arrowPrev = showArrows ? `<button class="carousel-arrow prev" onclick="moveCarousel(-1)">❮</button>` : '';
    const arrowNext = showArrows ? `<button class="carousel-arrow next" onclick="moveCarousel(1)">❯</button>` : '';
    
    let dotsHtml = "";
    if (showArrows) {
        dotsHtml = `<div class="carousel-indicators">` + 
            mediaList.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="setCarouselSlide(${i})"></span>`).join("") + 
            `</div>`;
    }
    
    // Parse amenities
    let amenitiesHtml = "";
    if (prop.amenities) {
        const list = prop.amenities.split(",").filter(a => a.trim());
        list.forEach(a => {
            let icon = '✦'; // fallback icon
            const cleanA = a.trim().toLowerCase();
            if (cleanA.includes("wifi")) icon = '📶';
            else if (cleanA.includes("ac") || cleanA.includes("air")) icon = '❄️';
            else if (cleanA.includes("pool")) icon = '🏊';
            else if (cleanA.includes("gym") || cleanA.includes("fit")) icon = '🏋️';
            else if (cleanA.includes("park")) icon = '🚗';
            else if (cleanA.includes("kitchen")) icon = '🍳';
            else if (cleanA.includes("wash") || cleanA.includes("machine")) icon = '🧺';
            else if (cleanA.includes("sec")) icon = '🛡️';
            
            amenitiesHtml += `<span class="detail-amenity-pill"><span>${icon}</span> ${a.trim()}</span>`;
        });
    } else {
        amenitiesHtml = `<span style="color: var(--text-muted); font-size: 0.9rem;">No specific amenities listed.</span>`;
    }
    
    // Render body
    body.innerHTML = `
        <div class="property-detail-modal-grid">
            <div class="property-media-carousel">
                <div class="carousel-slides" id="carousel-slides-wrapper" style="transform: translateX(0px);">
                    ${slidesHtml}
                </div>
                ${arrowPrev}
                ${arrowNext}
                ${dotsHtml}
            </div>
            
            <div class="detail-info-container">
                <div class="detail-header-info">
                    <h2 class="detail-title">${prop.title}</h2>
                    <div class="detail-badges">
                        <span class="badge-location">📍 ${prop.location}</span>
                        ${prop.furnished_status ? `<span class="badge-furnished">🛋️ ${prop.furnished_status}</span>` : ''}
                        <span style="font-weight: 800; font-size: 1.4rem; color: var(--accent); margin-left: auto;">
                            $${prop.price_per_month.toLocaleString()}/mo
                        </span>
                    </div>
                </div>
                
                <div class="detail-meta-grid">
                    <div class="detail-meta-item">
                        <span class="detail-meta-label">Full Address</span>
                        <span class="detail-meta-value">${prop.address || 'N/A'}</span>
                    </div>
                    <div class="detail-meta-item">
                        <span class="detail-meta-label">Bedrooms & Bathrooms</span>
                        <span class="detail-meta-value">${prop.bedrooms} Bed${prop.bedrooms === 1 ? '' : 's'} / ${prop.bathrooms} Bath${prop.bathrooms === 1 ? '' : 's'}</span>
                    </div>
                    <div class="detail-meta-item">
                        <span class="detail-meta-label">Landlord/Owner</span>
                        <span class="detail-meta-value">${prop.owner_name || 'N/A'}</span>
                    </div>
                    <div class="detail-meta-item">
                        <span class="detail-meta-label">Listing Created</span>
                        <span class="detail-meta-value">${new Date(prop.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.5rem; letter-spacing: 0.5px;">About This Home</h4>
                    <p class="detail-description">${prop.description || 'No description available for this property.'}</p>
                </div>
                
                <div>
                    <h4 style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.5rem; letter-spacing: 0.5px;">Amenities Included</h4>
                    <div class="detail-amenities-list">
                        ${amenitiesHtml}
                    </div>
                </div>
                
                ${actionsHtml}
            </div>
        </div>
    `;
    
    modal.classList.add("active");
}

function closePropertyDetails() {
    const modal = document.getElementById("property-detail-modal");
    if (modal) {
        modal.classList.remove("active");
        const body = document.getElementById("property-detail-body");
        if (body) {
            body.querySelectorAll("video").forEach(v => v.pause());
        }
    }
}

function moveCarousel(direction) {
    let nextIndex = currentCarouselIndex + direction;
    if (nextIndex < 0) nextIndex = carouselMediaCount - 1;
    if (nextIndex >= carouselMediaCount) nextIndex = 0;
    
    setCarouselSlide(nextIndex);
}

function setCarouselSlide(index) {
    currentCarouselIndex = index;
    const slidesWrapper = document.getElementById("carousel-slides-wrapper");
    if (slidesWrapper) {
        slidesWrapper.style.transform = `translateX(-${index * 100}%)`;
    }
    
    // Update dots
    const dots = document.querySelectorAll(".carousel-dot");
    dots.forEach((dot, idx) => {
        if (idx === index) dot.classList.add("active");
        else dot.classList.remove("active");
    });
}

// Switch sidebar active state and open the message view programmatically
function selectMessageTab() {
    window.location.hash = "messages";
}

// Start chat conversation with owner
function startOwnerChat(propertyId) {
    const prop = allProperties.find(p => p.id === propertyId);
    if (!prop) return;
    
    if (currentUser && prop.owner_id === currentUser.id) {
        showToast("You cannot message your own listing.", "error");
        return;
    }
    
    // Close details modal
    closePropertyDetails();
    
    // Check if chat conversation exists or create new
    let chat = mockChats.find(c => c.ownerId === prop.owner_id && c.propertyId === prop.id);
    if (!chat) {
        const newChatId = 100 + mockChats.filter(c => c.id >= 100).length;
        chat = {
            id: newChatId,
            ownerId: prop.owner_id,
            propertyId: prop.id,
            name: `${prop.owner_name} (${prop.title})`,
            preview: "Chat started about this property.",
            status: "Landlord",
            contactNumber: prop.contact_number || "+1 (555) 019-2834",
            messages: [
                { sender: "incoming", text: `Hello! I see you are interested in my property: ${prop.title}. How can I help you?` }
            ]
        };
        mockChats.push(chat);
        renderChatsList();
    }
    
    // Set activeChatIdToOpen first so selectMessageTab uses it
    activeChatIdToOpen = chat.id;
    
    // Switch to message tab
    selectMessageTab();
}

// Call request simulation helper (notification-based)
let callTimeout = null;

function triggerCallSimulation(propertyId) {
    const prop = allProperties.find(p => p.id === propertyId);
    if (!prop) return;
    
    if (currentUser && prop.owner_id === currentUser.id) {
        showToast("You cannot call your own listing.", "error");
        return;
    }
    
    // Close details modal
    closePropertyDetails();
    
    showToast(`Notification sent: Requesting call with ${prop.owner_name}...`, "info");
    
    if (callTimeout) {
        clearTimeout(callTimeout);
    }
    
    // Decide random result after 3.5s (65% chance Accepted, 35% chance out of area)
    callTimeout = setTimeout(() => {
        const isAccepted = Math.random() < 0.65;
        
        if (isAccepted) {
            showToast("Call request accepted!", "success");
            
            // Switch to chat tab
            selectMessageTab();
            
            // Check if chat exists or create new
            let chat = mockChats.find(c => c.ownerId === prop.owner_id && c.propertyId === prop.id);
            if (!chat) {
                const newChatId = 100 + mockChats.filter(c => c.id >= 100).length;
                chat = {
                    id: newChatId,
                    ownerId: prop.owner_id,
                    propertyId: prop.id,
                    name: `${prop.owner_name} (${prop.title})`,
                    preview: "Call accepted. Contact shared.",
                    status: "Landlord",
                    contactNumber: prop.contact_number || "+1 (555) 019-2834",
                    messages: [
                        { sender: "incoming", text: `Hello! I see you are interested in my property: ${prop.title}.` }
                    ]
                };
                mockChats.push(chat);
                renderChatsList();
            }
            
            // Send the contact details in chat
            const landlordNumber = prop.contact_number || "+1 (555) 019-2834";
            chat.messages.push({
                sender: "incoming",
                text: `📞 Call request accepted! Here is my mobile number: ${landlordNumber}. Feel free to call me directly.`
            });
            chat.preview = `Mobile number: ${landlordNumber}`;
            
            // Refresh chats list and open this chat room
            renderChatsList();
            openChat(chat.id);
        } else {
            showToast("Call request declined: Landlord is out of area.", "error");
            setTimeout(() => {
                alert(`Call failed: Landlord ${prop.owner_name} is currently out of area.`);
            }, 400);
        }
        callTimeout = null;
    }, 3500);
}

// Open property modal in Edit Mode
function openEditPropertyModal(propertyId) {
    const prop = allProperties.find(p => p.id === propertyId);
    if (!prop) return;
    
    closePropertyDetails();
    
    isEditMode = true;
    editPropertyId = propertyId;
    
    const propertyModal = document.getElementById("property-modal");
    if (!propertyModal) return;
    
    const titleEl = propertyModal.querySelector(".modal-title");
    if (titleEl) titleEl.innerText = "Edit Your Rental Home";
    
    const submitEl = propertyModal.querySelector('button[type="submit"]');
    if (submitEl) submitEl.innerText = "Save Changes";
    
    // Pre-fill fields
    document.getElementById("prop-title").value = prop.title;
    document.getElementById("prop-price").value = prop.price_per_month;
    document.getElementById("prop-desc").value = prop.description || "";
    document.getElementById("prop-owner").value = prop.owner_name || "";
    // Note: contact_number is stored in DB but excluded from public PropertyOut. If undefined, pre-fill empty.
    document.getElementById("prop-contact").value = prop.contact_number || "";
    document.getElementById("prop-bedrooms").value = prop.bedrooms;
    document.getElementById("prop-bathrooms").value = prop.bathrooms;
    document.getElementById("prop-furnished").value = prop.furnished_status || "Furnished";
    document.getElementById("prop-location").value = prop.location;
    document.getElementById("prop-address").value = prop.address || "";
    
    // Checkboxes
    const amenitiesList = prop.amenities ? prop.amenities.split(",").map(a => a.trim()) : [];
    const checkboxes = propertyModal.querySelectorAll('input[name="amenity"]');
    checkboxes.forEach(cb => {
        cb.checked = amenitiesList.includes(cb.value);
    });
    
    // Media URLs
    let urls = [];
    if (prop.media_urls) {
        urls = prop.media_urls.split(",").map(url => url.trim()).filter(url => url.length > 0);
    }
    if (urls.length === 0 && prop.image_url) {
        urls = [prop.image_url];
    }
    renderPropertyUploadPreviews(urls);
    
    propertyModal.classList.add("active");
}

// Trigger Property Delete
async function triggerDeleteProperty(propertyId) {
    const prop = allProperties.find(p => p.id === propertyId);
    if (!prop) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete "${prop.title}"?`);
    if (!confirmDelete) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/properties/${propertyId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            let detail = "Failed to delete property listing";
            try {
                const data = await response.json();
                detail = data.detail || detail;
            } catch (e) {}
            throw new Error(detail);
        }
        
        showToast("Listing deleted successfully!", "success");
        closePropertyDetails();
        
        // Reload properties
        await fetchProperties();
        
        // If on mylistings view, reload mylistings grid
        const activeMenuItem = document.querySelector(".menu-item.active");
        if (activeMenuItem && activeMenuItem.getAttribute("data-view") === "mylistings") {
            renderMyListings();
        }
    } catch (error) {
        showToast(error.message, "error");
    }
}

// Helper functions for property image upload preview rendering
function renderPropertyUploadPreviews(urls) {
    const previewContainer = document.getElementById("prop-media-preview-container");
    const mediaUrlsInput = document.getElementById("prop-media-urls");
    if (!previewContainer || !mediaUrlsInput) return;
    
    mediaUrlsInput.value = urls.join(",");
    previewContainer.innerHTML = "";
    
    urls.forEach((url, index) => {
        const card = document.createElement("div");
        card.style.position = "relative";
        card.style.width = "70px";
        card.style.height = "70px";
        card.style.borderRadius = "6px";
        card.style.overflow = "hidden";
        card.style.border = "1px solid var(--border-color)";
        
        const imgSrc = (url.startsWith("http://") || url.startsWith("https://")) ? url : `${API_BASE}${url}`;
        card.innerHTML = `
            <img src="${imgSrc}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">
            <button type="button" style="position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer;" onclick="removePropertyUploadImage(${index})">✕</button>
        `;
        previewContainer.appendChild(card);
    });
}

// Global function to remove property image from preview
window.removePropertyUploadImage = function(index) {
    const mediaUrlsInput = document.getElementById("prop-media-urls");
    if (!mediaUrlsInput) return;
    
    let urls = mediaUrlsInput.value.split(",").map(u => u.trim()).filter(u => u.length > 0);
    urls.splice(index, 1);
    
    renderPropertyUploadPreviews(urls);
};


