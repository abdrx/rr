// Import API service
import { 
  login, register, getProfile, 
  createTitle, getTitles, getTitle, updateTitle, deleteTitle,
  uploadReference, getReferences, getGlobalReferences, deleteReference,
  generateThumbnails as generatePaintings, getThumbnails as getPaintings,regeneratePainting
} from './apiService.js';

// Simulated Server API
const ServerAPI = {
    // Simulated server data storage (In a real app, this would be on the server)
    _data: {
        titles: [],
        globalReferences: []
    },

    //write a code to regenerate a thumbnail with id
    
    
    // Get data from server
    async getTitles() {
        // Simulate network delay
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([...this._data.titles]);
            }, 300);
        });
    },
    
    async getGlobalReferences() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([...this._data.globalReferences]);
            }, 300);
        });
    },

    async regenerateThumbnail(titleObj, references, index) {
    // Find the thumbnail by index and get its ID
    const thumbnail = titleObj.thumbnails[index];
    if (!thumbnail || !thumbnail.id) {
      throw new Error('Thumbnail not found for regeneration');
    }
    // Call your backend API to regenerate the thumbnail
    // Adjust the API call as needed for your backend
    const response = await apiRegenerateThumbnail(titleObj.id, thumbnail.id, references);
    // Assume response.data contains the new thumbnail object
    return response.data;
  },

  
    
    // Save data to server
    async saveTitles(titles) {
        return new Promise(resolve => {
            setTimeout(() => {
                this._data.titles = [...titles];
                resolve({ success: true });
            }, 300);
        });
    },
    
    async saveGlobalReferences(references) {
        return new Promise(resolve => {
            setTimeout(() => {
                this._data.globalReferences = [...references];
                resolve({ success: true });
            }, 300);
        });
    },
    
    // Get a specific title by id
    async getTitleById(id) {
        return new Promise(resolve => {
            setTimeout(() => {
                const title = this._data.titles.find(t => t.id === id);
                resolve(title || null);
            }, 200);
        });
    },

async generateThumbnails(titleObj, references, quantity, startIndex = 0) {
  const thumbnails = new Array(quantity);
  const promises = [];

  for (let i = 0; i < quantity; i++) {
    const index = startIndex + i;
    insertProgressCard(index);

    const promise = (async () => {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
      
      const concept = {
        id: generateID(),
        index: index,
        title: titleObj.title,
        instructions: titleObj.instructions,
        summary: generatePromptSummary(titleObj.title, titleObj.instructions),
        fullPrompt: generateFullPrompt(titleObj.title, titleObj.instructions, index)
      };

      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

      const thumbnailData = {
        id: concept.id,
        image_url: `https://placehold.co/600x400/3498db/ffffff?text=Thumbnail+${index + 1}`,
        summary: concept.summary,
        promptDetails: {
          summary: concept.summary,
          title: concept.title,
          instructions: concept.instructions || 'No custom instructions provided',
          referenceCount: references.length,
          referenceImages: references.map(ref => ref.data),
          fullPrompt: concept.fullPrompt
        },
        status: 'completed',
        index: concept.index,
        title_id: titleObj.id
      };

      thumbnails[i] = thumbnailData;
      
      if (thumbnailReady) {
        thumbnailReady(thumbnailData);
      }
    })();

    promises.push(promise);
  }

  await Promise.all(promises);
  return thumbnails;
},

    
    // Regenerate a single thumbnail
    async regenerateThumbnail(titleObj, references, index) {
        return new Promise(resolve => {
            setTimeout(() => {
                const summaryText = generatePromptSummary(titleObj.title, titleObj.instructions);
                
                const thumbnailData = {
                    id: generateID(),
                    image_url: `https://placehold.co/600x400/e74c3c/ffffff?text=Regenerated+${index+1}`,
                    summary: `Regenerated concept ${index+1} for "${titleObj.title}"`,
                    promptDetails: {
                        summary: summaryText,
                        title: titleObj.title,
                        instructions: titleObj.instructions || 'No custom instructions provided',
                        referenceCount: references.length,
                        referenceImages: references.map(ref => ref.data),
                        fullPrompt: generateFullPrompt(titleObj.title, titleObj.instructions, index)
                    }
                };
                
                resolve(thumbnailData);
            }, 2000);
        });
    }
};

// Data Storage (will now communicate with the backend)
let titles = [];
let globalReferences = [];
let currentTitle = null;
let currentReferenceDataMap = {}; // New: To store reference image data for the current view
let isLoading = true;
let currentUser = null;
let activePolls = {}; // Track active polls by titleId

let processingCards = {}; // Track processing cards per title

function insertProgressCard(idx, summary = 'Generating...') {
  // Limit summary to 150 characters
  let shortSummary = summary.length > 150 ? summary.slice(0, 147) + '...' : summary;

  thumbnailsGrid.insertAdjacentHTML(
    'beforeend',
    `<div class="thumbnail-item" id="thumb-${idx}" data-stage="progress" style="max-height: 260px; overflow: hidden; position: relative;">
        <div class="loading-thumbnail" style="display: flex; flex-direction: column; align-items: center; position: relative;">
          <div style="position: relative; width: 100%;">
            <img src="https://placehold.co/600x400/cccccc/ffffff?text=${encodeURIComponent(shortSummary)}" 
                 alt="${shortSummary}" style="width:100%;height:150px;object-fit:cover;max-height:150px;">
            <span class="spinner" style="
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                width: 32px;
                height: 32px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                z-index: 2;
            "></span>
          </div>
          <span style="display:block; max-width: 100%; max-height: 80px; overflow: hidden; text-overflow: ellipsis; white-space: pre-line; font-size: 0.95em; margin-top: 8px; text-align: center;">
            ${shortSummary}
          </span>
        </div>
     </div>
     <style>
     @keyframes spin {
       0% { transform: translate(-50%, -50%) rotate(0deg);}
       100% { transform: translate(-50%, -50%) rotate(360deg);}
     }
     </style>
     `
  );
}

// Utility to persist processingCards
function saveProcessingCards() {
    localStorage.setItem('processingCards', JSON.stringify(processingCards));
}
function loadProcessingCards() {
    const data = localStorage.getItem('processingCards');
    processingCards = data ? JSON.parse(data) : {};
}
function onThumbnailCompleted(titleId, index) {
  if (processingCards[titleId]) {
    processingCards[titleId] = processingCards[titleId].filter(proc => proc.index !== index);
    if (processingCards[titleId].length === 0) delete processingCards[titleId];
    saveProcessingCards();
  }
}

// Call this at app start
// loadProcessingCards();

// DOM Elements
const titleList = document.getElementById('title-list');
const titleInput = document.getElementById('title-input');
const customInstructions = document.getElementById('custom-instructions');
const quantitySelect = document.getElementById('quantity-select');
const generateBtn = document.getElementById('generate-btn');
const moreThumbnailsBtn = document.getElementById('more-thumbnails-btn');
const moreThumbnailsSection = document.getElementById('more-thumbnails-section');
const thumbnailsGrid = document.getElementById('thumbnails-grid');
const thumbnailsEmptyState = document.getElementById('thumbnails-empty-state');
const progressSection = document.getElementById('progress-section');
const ai1Progress = document.getElementById('ai1-progress');
const ai2Progress = document.getElementById('ai2-progress');
const ai1Status = document.getElementById('ai1-status');
const ai2Status = document.getElementById('ai2-status');
const newTitleBtn = document.getElementById('new-title-btn');
const globalReferenceToggle = document.getElementById('global-reference-toggle');
const globalReferencesSection = document.getElementById('global-references');
const titleReferencesSection = document.getElementById('title-references');
const globalDropzone = document.getElementById('global-dropzone');
const titleDropzone = document.getElementById('title-dropzone');
const globalFileInput = document.getElementById('global-file-input');
const titleFileInput = document.getElementById('title-file-input');
const globalUploadBtn = document.getElementById('global-upload-btn');
const titleUploadBtn = document.getElementById('title-upload-btn');
const globalReferenceImages = document.getElementById('global-reference-images');
const titleReferenceImages = document.getElementById('title-reference-images');
const promptModal = document.getElementById('prompt-modal');
const closeModal = document.querySelector('.close-modal');
const modalImage = document.getElementById('modal-image');
const promptSummary = document.getElementById('prompt-summary');
const promptTitle = document.getElementById('prompt-title');
const promptInstructions = document.getElementById('prompt-instructions');
const referenceCount = document.getElementById('reference-count');
const referenceThumbnails = document.getElementById('reference-thumbnails');
const fullPrompt = document.getElementById('full-prompt');
const loadingOverlay = document.getElementById('loading-overlay');

// Callback to handle when a thumbnail is ready
let thumbnailReady = null;

// Initialize the application
async function init() {
    console.log("Initializing app...");
    showLoading(true);
    
    // Set up event listeners first, so they're connected regardless of auth state
    setupEventListeners();
    
    try {
        // Check if user is logged in (token exists)
        const token = localStorage.getItem('token');
        if (token) {
            console.log("Token found, getting user profile...");
            // Get user profile
            const response = await getProfile();
            currentUser = response.data.user;
            
            // Set username in the UI
            document.getElementById('username-display').textContent = currentUser.username;
            
            // Load data
            await loadUserData();
        } else {
            console.log("No token found, showing login form...");
            // Show login form
            showLoginForm();
        }
    } catch (error) {
        console.error('Failed to initialize app:', error);
        // If token is invalid, show login form
        localStorage.removeItem('token');
        showLoginForm();
    } finally {
        showLoading(false);
    }
}

// Show/hide loading indicator
function showLoading(show) {
    console.log("Loading indicator:", show ? "SHOWING" : "HIDING");
    isLoading = show;
    
    // Show/hide the loading overlay
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    } else {
        console.error("Loading overlay element not found!");
    }
    
    // Disable buttons while loading
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = show;
    });
}

// Load user data from server
async function loadUserData() {
    try {
        // Fetch titles
        console.log('LUD: Fetching titles...');
        const titlesResponse = await getTitles();
        titles = titlesResponse.data.titles;
        console.log('LUD: Titles fetched:', titles ? titles.length : 0);
        
        // Fetch global references
        console.log('LUD: Fetching global references...');
        const referencesResponse = await getGlobalReferences();
        console.log('LUD: Global references API response:', referencesResponse);
        globalReferences = referencesResponse.data.references;
        console.log('LUD: Stored global references:', globalReferences);
        
        // Render UI
        console.log('LUD: Rendering titles list...');
        renderTitlesList();
        console.log('LUD: Rendering global reference images...');
        renderReferenceImages(globalReferences, globalReferenceImages);
        console.log('LUD: Global reference images rendered.');
        
        // Show main app container and hide login/register forms
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';

        // If titles are loaded, start polling for the first one for demonstration
        if (titles && titles.length > 0) {
            const firstTitleId = titles[0].id;
            const defaultQuantity = 5;
            console.log(`LUD: Automatically starting polling for title ID: ${firstTitleId}, quantity: ${defaultQuantity}`);
            pollThumbnailStatus(firstTitleId, defaultQuantity);
        } else {
            console.log('LUD: No titles found, not starting auto-polling.');
        }
        console.log('LUD: User data loading complete.');
    } catch (error) {
        console.error('Error loading user data (LUD):', error);
        if (error.response) {
            console.error('LUD: Server error response:', error.response.status, error.response.data);
        }
        alert('Failed to load data. Please try again.');
    }
}

// Show login form
function showLoginForm() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await login(email, password);
        localStorage.setItem('token', response.data.token);
        currentUser = response.data.user;
        await loadUserData();
    } catch (error) {
        console.error('Login error:', error);
        alert(error.response?.data?.error || 'Login failed. Please try again.');
    }
}

// Handle register
async function handleRegister(event) {
    event.preventDefault();
    console.log("Register form submitted");
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    if (!username || !email || !password) {
        alert("Please fill in all fields");
        return;
    }
    
    try {
        showLoading(true);
        console.log("Sending register request...", { username, email });
        const response = await register(username, email, password);
        console.log("Register response:", response.data);
        localStorage.setItem('token', response.data.token);
        currentUser = response.data.user;
        
        // Set username in the UI
        document.getElementById('username-display').textContent = currentUser.username;
        
        await loadUserData();
    } catch (error) {
        console.error('Registration error:', error);
        if (error.response && error.response.data) {
            alert(error.response.data.error || 'Registration failed. Please try again.');
        } else {
            alert('Registration failed. Please check your network connection and try again.');
        }
    } finally {
        showLoading(false);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    titles = [];
    globalReferences = [];
    currentTitle = null;
    showLoginForm();
}

// Event Listeners
function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // New Title Button
    newTitleBtn.addEventListener('click', () => {
        clearMainContent();
        titleInput.focus();
    });

/* ---------- tiny utilities ---------- */
function nextStartIndex() {
  return currentTitle && Array.isArray(currentTitle.thumbnails)
    ? currentTitle.thumbnails.length
    : thumbnailsGrid.querySelectorAll('.thumbnail-item').length;
}



function startBatchPolling(titleId, startIdx, qty, token) {
  const finished = new Set();

  (async function loop() {
    while (token === currentPollingToken) {        // ← **STOP** if user switched
      try {
        const { data } = await getPaintings(titleId, { timeout: 0 });
        const list = (data.paintings || []).filter(
          p => p.title_id === titleId && p.index >= startIdx
        );

        list.forEach(p => {
          if (finished.has(p.index)) return;

          const box = document.getElementById(`thumb-${p.index}`);
          if (!box) return;                        // grid belongs to another title

          if (p.status === 'processing' && box.dataset.stage !== 'idea') {
            box.dataset.stage = 'idea';
            box.innerHTML =
              `<div class="loading-thumbnail">
                 <span class="spinner"></span>
                 <span>Generating idea…</span>
               </div>`;
          }
          if (p.status === 'completed' || p.status === 'failed') {
            renderThumbnail(p, p.index);
            finished.add(p.index);
          }
        });

        if (finished.size >= qty) return;         // batch done
      } catch (_) { /* swallow & retry */ }
      await new Promise(r => setTimeout(r, 2000));
    }
  })();
}


generateBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  if (!title) { alert('Please enter a title'); return; }

  showLoading(true);
  setTimeout(() => showLoading(false), 3000);

  try {
    const instructions = customInstructions.value.trim();
    const qty = parseInt(quantitySelect.value, 10) || 1;

    // create/update title
    if (!currentTitle || currentTitle.title !== title)
      currentTitle = (await createTitle(title, instructions)).data;
    else currentTitle = (await updateTitle(currentTitle.id, title, instructions)).data;

    // upload any new per-title refs
    if (!globalReferenceToggle.checked && currentTitle.references)
      for (const r of currentTitle.references)
        if (!r.id) await uploadReference(currentTitle.id, r.data, false);

    // 1. Track processing for this title
    if (!processingCards[currentTitle.id]) processingCards[currentTitle.id] = [];
    const startIdx = nextStartIndex();
    for (let i = 0; i < qty; i++) {
      processingCards[currentTitle.id].push({ index: startIdx + i, summary: 'Generating...' });
      insertProgressCard(startIdx + i);
    }
    saveProcessingCards();

    // 2. Fire the backend job & start scoped polling
    await generatePaintings(currentTitle.id, qty);
    startBatchPolling(currentTitle.id, startIdx, qty);

    // 3. Refresh sidebar titles (non-blocking)
    getTitles().then(res => { titles = res.data.titles; renderTitlesList(); });
  }
  catch (err) {
    showLoading(false);
    const msg = err.response
      ? `Server error (${err.response.status})`
      : err.message || 'Unknown error';
    alert(msg);
  }
});


    // More Thumbnails Button
    moreThumbnailsBtn.addEventListener('click', async () => {
        if (!currentTitle) return;
        
        showLoading(true);
        
        try {
            const quantity = parseInt(quantitySelect.value) || 3;
            
            // Generate more thumbnails
            await generatePaintings(currentTitle.id, quantity);
            
            // Get the updated thumbnails
            await loadThumbnails(currentTitle.id);
        } catch (error) {
            console.error('Error generating more thumbnails:', error);
            alert('Failed to generate additional thumbnails. Please try again.');
        } finally {
            showLoading(false);
        }
    });
    
    // Toggle reference type
    globalReferenceToggle.addEventListener('change', () => {
        const useGlobalRefs = globalReferenceToggle.checked;
        globalReferencesSection.style.display = useGlobalRefs ? 'block' : 'none';
        titleReferencesSection.style.display = useGlobalRefs ? 'none' : 'block';
        
        if (!useGlobalRefs && currentTitle) {
            renderReferenceImages(currentTitle.references, titleReferenceImages);
        }
    });
    
    // Global upload button
    globalUploadBtn.addEventListener('click', () => {
        globalFileInput.click();
    });
    
    // Title-specific upload button
    titleUploadBtn.addEventListener('click', () => {
        titleFileInput.click();
    });
    
    // Global file input change
    globalFileInput.addEventListener('change', (e) => {
        handleFileUpload(e, globalReferences, globalReferenceImages, true);
    });
    
    // Title-specific file input change
    titleFileInput.addEventListener('change', (e) => {
        if (!currentTitle) {
            alert('Please enter a title first');
            return;
        }
        handleFileUpload(e, currentTitle.references, titleReferenceImages, false);
    });
    
    // Drag and drop events for dropzones
    setupDragAndDrop(globalDropzone, globalReferences, globalReferenceImages, true);
    setupDragAndDrop(titleDropzone, currentTitle?.references || [], titleReferenceImages, false);
    
    // Modal close button
    closeModal.addEventListener('click', closePromptModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === promptModal) {
            closePromptModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && promptModal.style.display === 'block') {
            closePromptModal();
        }
    });
    
    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log("Login form listener attached");
    } else {
        console.error("Login form not found!");
    }
    
    // Register form toggle
    const showRegisterLink = document.getElementById('show-register');
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('register-form').style.display = 'block';
            console.log("Switched to register form");
        });
    }
    
    // Login form toggle
    const showLoginLink = document.getElementById('show-login');
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
            console.log("Switched to login form");
        });
    }
    
    // Register form submit
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        console.log("Register form listener attached");
    } else {
        console.error("Register form not found!");
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Process uploaded files
async function handleFiles(files, referencesArray, displayElement, isGlobal) {
    if (!files.length) return;

    for (const file of files) {
        if (!file.type.match('image.*')) {
            alert('Please upload only image files');
            continue;
        }

        try {
            // Read file as data URL
            const imageData = await readFileAsDataURL(file);

            let newReference;
            if (isGlobal) {
                // Upload global reference to server
                const response = await uploadReference(null, imageData, true);
                newReference = {
                    id: response.data.id,
                    data: imageData
                };
                globalReferences.push(newReference);
            } else {
                if (!currentTitle.references) {
                    currentTitle.references = [];
                }

                if (currentTitle.id) {
                    // Upload title-specific reference to server
                    const response = await uploadReference(currentTitle.id, imageData, false);
                    newReference = {
                        id: response.data.id,
                        data: imageData
                    };
                    currentTitle.references.push(newReference);
                } else {
                    // Store locally until title is created
                    newReference = {
                        data: imageData
                    };
                    currentTitle.references.push(newReference);
                }
            }

            // Update UI after each successful upload
            renderReferenceImages(isGlobal ? globalReferences : currentTitle.references, displayElement);

        } catch (error) {
            console.error('Error processing file:', error);
            alert(`Failed to process reference image ${file.name}. Please try again.`);
        }
    }
}

// Setup drag and drop functionality
function setupDragAndDrop(dropzone, referencesArray, displayElement, isGlobal) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('dragover');
        }, false);
    });
    
    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (!isGlobal && !currentTitle) {
            alert('Please enter a title first');
            return;
        }
        
        handleFiles(files, referencesArray, displayElement, isGlobal);
    }, false);
}

// Handle file uploads from input or drag-and-drop
function handleFileUpload(event, referencesArray, displayElement, isGlobal) {
    const files = event.target.files;
    handleFiles(files, referencesArray, displayElement, isGlobal);
    event.target.value = ''; // Reset the input
}


// Promise-based file reader
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsDataURL(file);
    });
}

// Render reference images
function renderReferenceImages(references, container) {
    container.innerHTML = '';
    
    if (!references || !Array.isArray(references) || references.length === 0) {
        container.innerHTML = '<p class="empty-state">No reference images uploaded</p>';
        return;
    }
    
    references.forEach(ref => {
        // Use ref.image_data if ref.data is not present (for data loaded from backend)
        // Use ref.data if present (for freshly uploaded images not yet saved/reloaded)
        const imageDataString = ref.image_data || ref.data;

        if (!ref || !imageDataString) {
            console.warn('Invalid reference found or missing image data:', ref);
            return; // Skip this reference
        }
        
        const imgContainer = document.createElement('div');
        imgContainer.className = 'reference-image';

        
        
        const img = document.createElement('img');
        img.src = imageDataString;
        img.alt = 'Reference Image';
        img.onerror = () => {
            console.warn('Failed to load reference image:', ref.id);
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"%3E%3Cpath fill="%23ccc" d="M21.9 21.9l-8.49-8.49-9.93-9.93L2.1 2.1 .69 3.51 3 5.83V19c0 1.1 .9 2 2 2h13.17l2.31 2.31 1.42-1.41zM5 18l3.5-4.5 2.5 3.01L12.17 15l3 3H5zm16 .17L5.83 3H19c1.1 0 2 .9 2 2v13.17z"/%3E%3C/svg%3E';
            img.alt = 'Broken Image';
        };
        
        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-image';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            // Ensure ref.id exists. If it was a freshly added client-side only ref without an ID,
            // this might need a different way to remove it (e.g., by index or object equality).
            if (ref.id) {
                removeReferenceImage(ref.id, references, container);
            } else {
                // Fallback for locally added items without an ID yet (if any)
                const indexToRemove = references.indexOf(ref);
                if (indexToRemove > -1) {
                    references.splice(indexToRemove, 1);
                    renderReferenceImages(references, container); // Re-render
                }
                console.warn('Attempted to remove reference without an ID', ref);
            }
        });
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(removeBtn);
        container.appendChild(imgContainer);
    });
}

// Remove a reference image
async function removeReferenceImage(id, references, container) {
    try {
        // Delete from server
        await deleteReference(id);

        // Remove from local array
        const index = references.findIndex(ref => ref.id === id);
        if (index !== -1) {
            references.splice(index, 1);
            // Update UI after successful removal
            renderReferenceImages(references, container);
        } else {
            console.warn(`Reference with ID ${id} not found in local array.`);
        }
    } catch (error) {
        console.error('Error removing reference image:', error);
        alert('Failed to delete reference image. Please try again.');
    }
}

// Generate thumbnails using server API
async function generateServerThumbnails(titleObj, references, quantity, isAdditional) {
    // Show progress section
    progressSection.style.display = 'block';
    thumbnailsEmptyState.style.display = 'none';
    
    // Clear existing thumbnails if not generating additional ones
    if (!isAdditional) {
        thumbnailsGrid.innerHTML = '';
        titleObj.thumbnails = [];
    }
    
    // Get the starting index for new thumbnails
    const startIndex = isAdditional ? titleObj.thumbnails.length : 0;
    
    // Setup loading thumbnails
    for (let i = 0; i < quantity; i++) {
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'thumbnail-item';
        thumbContainer.id = `thumb-${startIndex + i}`;
        
        const loadingThumb = document.createElement('div');
        loadingThumb.className = 'loading-thumbnail';
        
        thumbContainer.appendChild(loadingThumb);
        thumbnailsGrid.appendChild(thumbContainer);
    }
    
    // Track completed thumbnails
    const completedThumbnails = [];
    
    // Set up callback for when thumbnails are ready
    thumbnailReady = (thumbnail) => {
        // Render the thumbnail as soon as it's ready
        renderThumbnail(thumbnail, thumbnail.index);
        completedThumbnails.push(thumbnail);
        
        // Update the AI2 status
        ai2Status.textContent = `Creating images... ${completedThumbnails.length}/${quantity} complete`;
        ai2Progress.style.width = `${(completedThumbnails.length / quantity) * 100}%`;
    };
    
    try {
        // Simulate AI 1 (concept generation) - sequential
        ai1Status.textContent = 'Generating painting ideas...';
        simulateProgress(ai1Progress, null, null, 'Painting concepts ready!', 3000, async () => {
            // After AI 1 completes, start AI 2 (image generation) - parallel
            ai2Status.textContent = 'Creating images... 0/' + quantity + ' complete';
            ai2Progress.style.width = '0%';
            
            // Get AI-generated thumbnails from server (now in parallel)
            const newThumbnails = await ServerAPI.generateThumbnails(titleObj, references, quantity, startIndex);
            
            // After all thumbnails are generated
            progressSection.style.display = 'none';
            moreThumbnailsSection.style.display = 'block';
            
            // Save the generated thumbnails
            if (isAdditional) {
                titleObj.thumbnails = [...titleObj.thumbnails, ...newThumbnails];
            } else {
                titleObj.thumbnails = newThumbnails;
            }
            
            await saveData();
            
            // Clear the callback
            thumbnailReady = null;
        });
    } catch (error) {
        console.error('Error generating thumbnails:', error);
        alert('Failed to generate paintings. Please try again.');
        progressSection.style.display = 'none';
        thumbnailReady = null;
    }
}

// Generate a summary of the prompt
function generatePromptSummary(title, instructions) {
    if (!instructions || instructions.trim() === '') {
        return `A painting for "${title}" with standard settings`;
    }
    
    // Extract keywords from instructions to create a summary
    const words = instructions.split(' ');
    const keyPhrases = [];
    
    if (words.length <= 5) {
        return `A ${instructions.toLowerCase()} painting for "${title}"`;
    }
    
    // Look for style indicators
    const styleWords = ['style', 'design', 'look', 'aesthetic', 'theme'];
    const colorWords = ['color', 'blue', 'red', 'green', 'yellow', 'dark', 'light', 'bright', 'pastel'];
    
    // Extract style phrases
    for (let i = 0; i < words.length - 1; i++) {
        if (styleWords.includes(words[i].toLowerCase())) {
            keyPhrases.push(`${words[i]} ${words[i+1]}`);
        }
        if (colorWords.includes(words[i].toLowerCase())) {
            keyPhrases.push(words[i]);
        }
    }
    
    if (keyPhrases.length > 0) {
        return `A painting for "${title}" with ${keyPhrases.join(', ')}`;
    }
    
    // Fallback: just take the first few words
    return `A painting for "${title}" with ${instructions.substring(0, 40)}${instructions.length > 40 ? '...' : ''}`;
}

// Generate full prompt for the AI
function generateFullPrompt(title, instructions, index) {
    const basePrompt = `Create a painting image for a content piece titled "${title}".`;
    
    let fullPrompt = basePrompt;
    
    if (instructions && instructions.trim() !== '') {
        fullPrompt += `\nCustom instructions: ${instructions}`;
    }
    
    // Add some variety based on the index
    const variations = [
        'Make it eye-catching and professional.',
        'Ensure it stands out in search results.',
        'Design it to attract the target audience.',
        'Create a visually appealing composition.',
        'Make it modern and trendy.'
    ];
    
    fullPrompt += `\n${variations[index % variations.length]}`;
    
    return fullPrompt;
}

// Render a single thumbnail
function renderThumbnail(thumbnailData, index) {
    console.log('Rendering thumbnail data:', thumbnailData);
    const thumbContainer = document.getElementById(`thumb-${index}`);
    thumbContainer.innerHTML = '';
    thumbContainer.dataset.id = thumbnailData.id;
    
    if (thumbnailData.status === 'failed') {
        // Show error state for failed thumbnails
        const errorDiv = document.createElement('div');
        errorDiv.className = 'thumbnail-error';
        
        const errorIcon = document.createElement('div');
        errorIcon.className = 'error-icon';
        errorIcon.innerHTML = '!';
        
        const errorMessage = document.createElement('p');
        errorMessage.className = 'error-message';
        errorMessage.textContent = thumbnailData.error_message || 'Thumbnail generation failed';
        
        errorDiv.appendChild(errorIcon);
        errorDiv.appendChild(errorMessage);
        
        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'action-btn';
        regenerateBtn.textContent = 'Try Again';
        regenerateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            regenerateSingleThumbnail(index, thumbnailData.id);
        });
        
        errorDiv.appendChild(regenerateBtn);
        thumbContainer.appendChild(errorDiv);
        return;
    }
    
    // Regular thumbnail rendering for successful thumbnails

    // console.error('Rendering reference image:', ref.id, imageDataString);
    
    const img = document.createElement('img');
    img.src = thumbnailData.image_url;
    img.alt = thumbnailData.summary;
    img.className = 'thumbnail-image';
    
    const actions = document.createElement('div');
    actions.className = 'thumbnail-actions';
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'action-btn';
    downloadBtn.textContent = 'Download';
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent opening modal when clicking download
        // Download the image
        const link = document.createElement('a');
        link.href = thumbnailData.image_url;
        link.download = thumbnailData.summary.replace(/[^\w\d_\-]+/g, '_') + '.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        lert(`Downloading: ${thumbnailData.summary}`);
    });
    
    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'action-btn';
    regenerateBtn.textContent = 'Regenerate';
    regenerateBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent opening modal when clicking regenerate
        regenerateSingleThumbnail(index, thumbnailData.id);
    });
    
    actions.appendChild(downloadBtn);
    actions.appendChild(regenerateBtn);
    
    thumbContainer.appendChild(img);
    thumbContainer.appendChild(actions);
    
    // Add click event to view prompt details
    thumbContainer.addEventListener('click', () => {
        showPromptDetails(thumbnailData);
    });
}

// Show prompt details in modal
function showPromptDetails(thumbnailData) {
    // Set modal content
    modalImage.src = thumbnailData.image_url;
    promptSummary.textContent = thumbnailData.summary;
    // Ensure promptDetails and its properties exist, providing fallbacks
    const details = thumbnailData.promptDetails || {};
    promptTitle.textContent = details.title || (currentTitle ? currentTitle.title : 'N/A');
    promptInstructions.textContent = details.instructions || 'No custom instructions provided';
    referenceCount.textContent = details.referenceCount || 0;
    fullPrompt.textContent = details.fullPrompt || '';
    
    // Display reference images
    referenceThumbnails.innerHTML = '';
    if (details.referenceImages && Array.isArray(details.referenceImages) && details.referenceImages.length > 0) {
        details.referenceImages.forEach(refId => {
            const refImgData = currentReferenceDataMap[refId];
            if (refImgData) {
                const imgElement = document.createElement('img');
                imgElement.src = refImgData;
                imgElement.className = 'reference-thumb';
                imgElement.alt = `Reference Image (ID: ${refId})`;
                imgElement.onerror = () => { 
                    console.warn('Failed to load reference thumb from map:', refId); 
                    imgElement.alt = 'Error loading ref'; 
                }; 
                referenceThumbnails.appendChild(imgElement);
            } else {
                console.warn(`Reference ID ${refId} not found in currentReferenceDataMap.`);
            }
        });
        if (referenceThumbnails.children.length === 0) {
             referenceThumbnails.innerHTML = '<p class="empty-state">Reference image data missing.</p>';
        }
    } else {
        referenceThumbnails.innerHTML = '<p class="empty-state">No reference images used</p>';
    }
    
    // Show modal
    promptModal.style.display = 'block';
    
    // Prevent scrolling on background
    document.body.style.overflow = 'hidden';
}

async function regenerateSingleThumbnail(index, id) {
    if (!currentTitle) return;

    const thumbIdx = currentTitle.thumbnails.findIndex(t => t && t.id === id);
    if (thumbIdx === -1) {
        alert('Thumbnail not found for regeneration.');
        return;
    }

    const thumbContainer = document.getElementById(`thumb-${index}`);
    if (!thumbContainer) {
        alert('Thumbnail container not found.');
        return;
    }
    thumbContainer.innerHTML = '';

    const loadingThumb = document.createElement('div');
    loadingThumb.className = 'loading-thumbnail';
    loadingThumb.innerHTML = '<span class="spinner"></span><span>Regenerating…</span>';
    thumbContainer.appendChild(loadingThumb);

    try {
        // Call backend to trigger regeneration
        await regeneratePainting(id);

        // Optionally, poll or reload the thumbnail status after a delay
        setTimeout(() => loadThumbnails(currentTitle.id), 2000);
    } catch (error) {
        console.error('Error regenerating thumbnail:', error);
        thumbContainer.innerHTML = '<div class="thumbnail-error">Failed to regenerate thumbnail.</div>';
        alert('Failed to regenerate thumbnail. Please try again.');
    }
}

// Simulate progress for the AI processes
function simulateProgress(progressBar, statusElement, startMessage, endMessage, duration, callback) {
    let startTime = Date.now();
    let progress = 0;
    
    if (statusElement && startMessage) {
        statusElement.textContent = startMessage;
    }
    
    const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        if (elapsedTime >= duration) {
            progressBar.style.width = '100%';
            if (statusElement && endMessage) {
                statusElement.textContent = endMessage;
            }
            clearInterval(interval);
            if (callback) callback();
            return;
        }
        
        progress = (elapsedTime / duration) * 100;
        progressBar.style.width = `${progress}%`;
    }, 50);
}

// Render the list of titles in the sidebar
function renderTitlesList() {
    titleList.innerHTML = '';
    
    if (titles.length === 0) {
        titleList.innerHTML = '<div class="empty-state">No titles yet. Create your first one!</div>';
        return;
    }
    
    // Sort titles by timestamp/created_at (newest first)
    titles.sort((a, b) => {
        const timeA = a.timestamp || new Date(a.created_at).getTime();
        const timeB = b.timestamp || new Date(b.created_at).getTime();
        return timeB - timeA;
    });
    
    titles.forEach(title => {
        const titleItem = document.createElement('div');
        titleItem.className = 'title-item';
        titleItem.dataset.id = title.id; // Store ID as data attribute
        
        if (currentTitle && currentTitle.id === title.id) {
            titleItem.classList.add('active');
        }
        
        titleItem.textContent = title.title;
        titleItem.addEventListener('click', () => {
            loadTitle(title);
        });
        
        titleList.appendChild(titleItem);
    });
}

async function loadTitle(titleItem) {
  showLoading(true);

  try {
    const titleId = titleItem.id;

    // Stop polling all other titles except the current
    Object.keys(activePolls).forEach(id => {
      if (parseInt(id) !== parseInt(titleId)) {
        delete activePolls[id];
      }
    });

    const titleResponse = await getTitle(titleId);
    currentTitle = titleResponse.data;

    const referencesResponse = await getReferences(titleId);
    currentTitle.references = referencesResponse.data.references;

    thumbnailsGrid.innerHTML = '';
    currentTitle.thumbnails = await loadThumbnails(titleId);

    titleInput.value = currentTitle.title;
    customInstructions.value = currentTitle.instructions || '';

    renderSavedThumbnails(currentTitle);

    document.querySelectorAll('.title-item').forEach(item => {
      item.classList.toggle('active', parseInt(item.dataset.id) === currentTitle.id);
    });

    if (currentTitle.references && currentTitle.references.length > 0) {
      globalReferenceToggle.checked = false;
      globalReferencesSection.style.display = 'none';
      titleReferencesSection.style.display = 'block';
      renderReferenceImages(currentTitle.references, titleReferenceImages);
    } else {
      globalReferenceToggle.checked = true;
      globalReferencesSection.style.display = 'block';
      titleReferencesSection.style.display = 'none';
    }

    moreThumbnailsSection.style.display = currentTitle.thumbnails.length > 0 ? 'block' : 'none';

    const pendingCount = currentTitle.thumbnails.filter(t => t.status === 'pending' || t.status === 'processing').length;
    if (pendingCount > 0) {
      pollThumbnailStatus(titleId, currentTitle.thumbnails.length);
    }

  } catch (error) {
    console.error('Error loading title:', error);
    alert('Failed to load title data. Please try again.');
  } finally {
    showLoading(false);
  }
}


function renderSavedThumbnails(title) {
    thumbnailsGrid.innerHTML = '';

    if (!title || !title.thumbnails || !Array.isArray(title.thumbnails) || title.thumbnails.length === 0) {
        thumbnailsEmptyState.style.display = 'block';
        return;
    }

    thumbnailsEmptyState.style.display = 'none';

    // Only show thumbnails that belong to this title
    const validThumbnails = title.thumbnails.filter(
        thumbnail =>
            thumbnail &&
            typeof thumbnail === 'object' &&
            thumbnail.id &&
            thumbnail.title_id === title.id // Only show if title_id matches
    );

    if (validThumbnails.length === 0) {
        thumbnailsEmptyState.style.display = 'block';
        return;
    }

    validThumbnails.forEach((thumbnail, index) => {
        try {
            const thumbContainer = document.createElement('div');
            thumbContainer.className = 'thumbnail-item';
            thumbContainer.id = `thumb-${index}`;
            thumbnailsGrid.appendChild(thumbContainer);

            renderThumbnail(thumbnail, index);
        } catch (error) {
            console.error(`Error rendering thumbnail at index ${index}:`, error);
        }
    });
}
// Clear main content for a new title
function clearMainContent() {
    currentTitle = null;
    titleInput.value = '';
    customInstructions.value = '';
    quantitySelect.value = '5';
    thumbnailsGrid.innerHTML = '';
    thumbnailsEmptyState.style.display = 'block';
    moreThumbnailsSection.style.display = 'none';
    
    // Update reference images sections
    globalReferenceToggle.checked = true;
    globalReferencesSection.style.display = 'block';
    titleReferencesSection.style.display = 'none';
    
    // Clear per-title references
    titleReferenceImages.innerHTML = '<p class="empty-state">No reference images uploaded</p>';
    
    // Update sidebar active state
    const titleItems = document.querySelectorAll('.title-item');
    titleItems.forEach(item => {
        item.classList.remove('active');
    });
}

// Save data to server
async function saveData() {
    try {
        await ServerAPI.saveTitles(titles);
        return true;
    } catch (error) {
        console.error('Error saving data to server:', error);
        alert('Failed to save data to server. Please try again.');
        return false;
    }
}

// Generate unique ID
function generateID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Close the prompt details modal
function closePromptModal() {
    promptModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Load thumbnails for a title
async function loadThumbnails(titleId) {
    try {
        console.log(`Fetching thumbnails for title ${titleId} from backend...`);
        const response = await getPaintings(titleId);
        // Use the paintings array instead of thumbnails since the API endpoint now returns paintings
        const thumbnails = response.data.paintings || [];
        currentReferenceDataMap = response.data.referenceDataMap || {}; // Store the map
        console.log('Received thumbnails data:', thumbnails);
        console.log('Received reference data map:', currentReferenceDataMap);
        
        // Update current title thumbnails
        if (currentTitle && currentTitle.id === titleId) {
            currentTitle.thumbnails = thumbnails;
            renderSavedThumbnails(currentTitle);
        }
        
        return thumbnails;
    } catch (error) {
        console.error('Error loading thumbnails:', error);
        currentReferenceDataMap = {}; // Clear map on error
        throw error;
    }
}

async function pollThumbnailStatus(titleId, expectedQuantity, attempt = 0) {
    const pollIdentifier = Symbol();
    activePolls[titleId] = pollIdentifier; // Assign a unique ID to the active poll for this title

    const maxAttempts = 60;
    const pollInterval = 3000;

    while (attempt < maxAttempts && activePolls[titleId] === pollIdentifier) {
        try {
            const response = await getPaintings(titleId);
            const thumbnails = response.data.paintings.filter(t => t.title_id === titleId);

            const completedCount = thumbnails.filter(t => t.status === 'completed' || t.status === 'failed').length;

            // thumbnailsGrid.innerHTML = ''; // Remove this line!

            thumbnails.forEach((thumbnail, index) => {
                // Check if the thumbnail container exists
                const thumbContainer = document.getElementById(`thumb-${index}`);
                if (thumbContainer) {
                    renderThumbnail(thumbnail, index); // Render only if the container exists
                } else {
                    console.warn(`Thumbnail container with ID thumb-${index} not found!`);
                }
            });

            const progressPercentage = (completedCount / expectedQuantity) * 100;
            ai2Status.textContent = `Generating images... ${completedCount}/${expectedQuantity} complete`;
            ai2Progress.style.width = `${progressPercentage}%`;

            if (completedCount >= expectedQuantity) {
                console.log(`Polling completed for title ${titleId}`);
                delete activePolls[titleId];
                progressSection.style.display = 'none';
                moreThumbnailsSection.style.display = 'block';
                break;
            }

            await new Promise(res => setTimeout(res, pollInterval));
            attempt++;
        } catch (error) {
            console.error(`Polling error for title ${titleId}:`, error);
            if (++attempt >= maxAttempts) {
                alert('Failed to retrieve updates. Please try again later.');
                delete activePolls[titleId];
                progressSection.style.display = 'none';
            } else {
                await new Promise(res => setTimeout(res, pollInterval));
            }
        }
    }
}

/* ─── Live sidebar refresh every 5 s ───────────────────────────── */
function startSidebarAutoRefresh() {
  setInterval(async () => {
    try {
      const res = await getTitles({ timeout: 0 });      // no 10 s limit
      const latest = res.data.titles || [];

      // quick diff test: id + updated_at
      const changed =
        latest.length !== titles.length ||
        latest.some((t, i) =>
          !titles[i] ||
          t.id !== titles[i].id ||
          t.updated_at !== titles[i].updated_at
        );

      if (changed) {
        titles = latest;
        renderTitlesList();     // existing function
      }
    } catch (_) {
      /* network hiccup → ignore & retry next tick */
    }
  }, 5000);
}
startSidebarAutoRefresh();

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', init); 

