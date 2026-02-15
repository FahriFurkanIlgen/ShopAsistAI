// ShopAsistAI Frontend Application
const API_BASE_URL = 'http://localhost:3000';
const SITE_ID = 'skechers-tr';

class ChatWidget {
  constructor() {
    this.conversationHistory = [];
    this.isOpen = false;
    this.isLoading = false;
    this.config = null;
    this.selectedCategory = null;
    this.hasShownWelcome = false; // Track if welcome message shown
    this.userScrolledUp = false; // Track if user manually scrolled up
    
    this.initElements();
    this.attachEventListeners();
    this.loadConfig();
    this.checkAPIStatus();
  }

  initElements() {
    this.chatToggle = document.getElementById('chat-toggle');
    this.chatWindow = document.getElementById('chat-window');
    this.chatClose = document.getElementById('chat-close');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.chatSend = document.getElementById('chat-send');
    this.productSuggestions = document.getElementById('product-suggestions');
    this.chatTitle = document.getElementById('chat-title');
    this.chatLogo = document.getElementById('chat-logo');
    this.welcomeMessage = document.getElementById('welcome-message');
    this.welcomeSubtext = document.getElementById('welcome-subtext');
    this.welcomeSection = document.getElementById('welcome-section');
    this.categorySection = document.getElementById('category-section');
    this.categoryButtons = document.getElementById('category-buttons');
    this.privacyFooter = document.getElementById('privacy-footer');
    this.privacyLink = document.getElementById('privacy-link');
    this.closePrivacy = document.getElementById('close-privacy');
    this.brandingFooter = document.getElementById('branding-footer');
    this.closePrivacy.addEventListener('click', () => {
      this.privacyFooter.style.display = 'none';
    });
  }

  async loadConfig() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/${SITE_ID}`);
      this.config = await response.json();
      this.applyConfig();
    } catch (error) {
      console.error('Error loading config:', error);
      this.config = {
        siteId: SITE_ID,
        siteName: 'Shop',
        primaryColor: '#4f46e5',
        secondaryColor: '#10b981',
      };
    }
  }

  applyConfig() {
    if (!this.config) return;

    // Apply branding
    if (this.config.siteName) {
      this.chatTitle.textContent = this.config.siteName;
    }

    if (this.config.brandLogo) {
      this.chatLogo.src = this.config.brandLogo;
      this.chatLogo.alt = this.config.siteName;
      this.chatLogo.style.display = 'block';
    }

    // Apply colors
    if (this.config.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', this.config.primaryColor);
    }
    if (this.config.secondaryColor) {
      document.documentElement.style.setProperty('--brand-secondary', this.config.secondaryColor);
    }

    // Apply welcome message
    if (this.config.welcomeMessage) {
      const message = this.config.welcomeMessage.replace('{SITE_NAME}', this.config.siteName);
      this.welcomeMessage.textContent = message;
    }

    if (this.config.welcomeSubtext) {
      this.welcomeSubtext.textContent = this.config.welcomeSubtext;
    }

    // Apply categories
    if (this.config.categories && this.config.categories.length > 0) {
      this.renderCategories();
      this.categorySection.style.display = 'block';
    }

    // Hide welcome section after first message
    if (this.conversationHistory.length === 0) {
      this.welcomeSection.style.display = 'none';
    }
    
    // Apply privacy policy
    if (this.config.privacyPolicyUrl) {
      this.privacyLink.href = this.config.privacyPolicyUrl;
      this.privacyFooter.style.display = 'flex';
    }

    // Apply branding
    if (this.config.showBranding && this.config.brandingText) {
      this.brandingText.textContent = this.config.brandingText;
    } else if (!this.config.showBranding) {
      this.brandingFooter.style.display = 'none';
    }
  }

  renderCategories() {
    if (!this.config.categories) return;

    this.categoryButtons.innerHTML = this.config.categories
      .map(
        (cat) => `
        <button class="category-btn" data-category-id="${cat.id}" data-keywords="${(cat.keywords || []).join(',')}">
          ${cat.emoji ? `<span class="category-emoji">${cat.emoji}</span>` : ''}
          <span>${cat.name}</span>
        </button>
      `
      )
      .join('');

    // Add click handlers
    this.categoryButtons.querySelectorAll('.category-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.handleCategoryClick(btn));
    });
  }

  async handleCategoryClick(btn) {
    const categoryId = btn.dataset.categoryId;
    const keywords = btn.dataset.keywords.split(',').filter((k) => k);

    // Toggle active state
    this.categoryButtons.querySelectorAll('.category-btn').forEach((b) => {
      b.classList.remove('active');
    });
    btn.classList.add('active');

    this.selectedCategory = categoryId;

    // Fetch products for this category
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${SITE_ID}/category?keywords=${encodeURIComponent(keywords.join(','))}`
      );
      const data = await response.json();

      if (data.products && data.products.length > 0) {
        this.addProductMessage(data.products, `${this.selectedCategory.name} kategorisinde sizin için seçtiklerim:`);
        
        // Hide welcome section after category selection
        if (this.conversationHistory.length === 0) {
          this.welcomeSection.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Error fetching category products:', error);
    }
    this.brandingText = document.getElementById('branding-text');
  }

  attachEventListeners() {
    this.chatToggle.addEventListener('click', () => this.toggleChat());
    this.chatClose.addEventListener('click', () => this.toggleChat());
    this.chatSend.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isLoading) {
        this.sendMessage();
      }
    });
    
    // Track user scroll behavior
    this.chatMessages.addEventListener('scroll', () => {
      this.checkScrollPosition();
    });
  }
  
  checkScrollPosition() {
    const container = this.chatMessages;
    const threshold = 50; // 50px tolerance
    
    // Check if user is near bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    
    // Update flag: true if user scrolled up (not at bottom)
    this.userScrolledUp = !isNearBottom;
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    this.chatWindow.classList.toggle('active', this.isOpen);
    
    if (this.isOpen) {
      this.chatInput.focus();
      
      // Show welcome message on first open (2 seconds after)
      if (!this.hasShownWelcome && this.conversationHistory.length === 0) {
        setTimeout(() => {
          if (this.conversationHistory.length === 0 && this.isOpen) {
            const welcomeText = this.config?.siteName 
              ? `Merhaba, hoş geldiniz! 👋 Ben ${this.config.siteName} yapay zeka asistanınızım. Size nasıl yardımcı olabilirim?`
              : 'Merhaba, hoş geldiniz! 👋 Ben yapay zeka asistanınızım. Size nasıl yardımcı olabilirim?';
            this.addMessage('assistant', welcomeText);
            this.hasShownWelcome = true;
          }
        }, 2000);
      }
    }
  }

  async checkAPIStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      
      if (data.status === 'ok') {
        console.log('✅ API Running - Products in cache:', data.cache.keys);
      }
    } catch (error) {
      console.error('❌ API Connection Failed:', error);
    }
  }

  addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const p = document.createElement('p');
    p.textContent = content;
    messageDiv.appendChild(p);
    
    this.chatMessages.appendChild(messageDiv);
    
    // Auto-scroll only if user hasn't manually scrolled up
    this.scrollToBottomIfNeeded();
    
    // Add to history
    this.conversationHistory.push({
      role: role === 'user' ? 'user' : 'assistant',
      content,
      timestamp: new Date(),
    });
  }

  scrollToBottomIfNeeded() {
    // Always scroll if user is typing (sending message) or if they're at bottom
    if (!this.userScrolledUp) {
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    // Use requestAnimationFrame for smoother scroll
    requestAnimationFrame(() => {
      this.chatMessages.scrollTo({
        top: this.chatMessages.scrollHeight,
        behavior: 'smooth'
      });
      
      // After smooth scroll completes, reset the userScrolledUp flag
      setTimeout(() => {
        this.userScrolledUp = false;
      }, 500);
    });
  }

  showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message loading';
    loadingDiv.id = 'loading-message';
    loadingDiv.innerHTML = `
      <div class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    this.chatMessages.appendChild(loadingDiv);
    this.scrollToBottomIfNeeded();
  }

  removeLoading() {
    const loadingMsg = document.getElementById('loading-message');
    if (loadingMsg) {
      loadingMsg.remove();
    }
  }

  addProductMessage(products, text = 'Sizin için önerdiğim ürünler:') {
    if (!products || products.length === 0) {
      return;
    }

    // Create assistant message with products
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    // Add intro text
    const introP = document.createElement('p');
    introP.textContent = text;
    messageDiv.appendChild(introP);
    
    // Add products container
    const productsContainer = document.createElement('div');
    productsContainer.className = 'products-in-message';
    productsContainer.innerHTML = products.map(product => {
      const specs = [];
      if (product.color) specs.push(product.color);
      if (product.size) specs.push(`Beden: ${product.size}`);
      const specsHtml = specs.length > 0 ? `<div class="product-specs">${specs.join(' • ')}</div>` : '';
      
      // Calculate discount
      let priceHtml = '';
      if (product.salePrice) {
        const oldPrice = this.extractPrice(product.price);
        const newPrice = this.extractPrice(product.salePrice);
        if (oldPrice && newPrice && newPrice < oldPrice) {
          const discountPercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
          priceHtml = `
            <div class="product-price-container">
              <div class="product-price-old">${product.price}</div>
              <div class="product-price">${product.salePrice}</div>
              <div class="product-discount">%${discountPercent} İNDİRİM</div>
            </div>
          `;
        } else {
          priceHtml = `<div class="product-price">${product.salePrice}</div>`;
        }
      } else {
        priceHtml = `<div class="product-price">${product.price}</div>`;
      }
      
      return `
      <div class="product-card" onclick="window.open('${product.link}', '_blank')" style="cursor: pointer;">
        <img src="${product.imageLink}" alt="${product.title}" class="product-image" onerror="this.src='https://via.placeholder.com/60'">
        <div class="product-info">
          <div class="product-title">${product.title}</div>
          ${specsHtml}
          ${priceHtml}
        </div>
      </div>
    `;
    }).join('');
    
    messageDiv.appendChild(productsContainer);
    this.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom after displaying products (only if user hasn't scrolled up)
    setTimeout(() => {
      this.scrollToBottomIfNeeded();
    }, 150);
  }

  displayProducts(products) {
    // Legacy method - redirects to addProductMessage
    this.addProductMessage(products);
  }

  extractPrice(priceStr) {
    const match = priceStr.match(/[\d.,]+/);
    if (match) {
      return parseFloat(match[0].replace(',', '.'));
    }
    return null;
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    
    if (!message || this.isLoading) return;
    
    // User is actively sending message, so they want to be at bottom
    this.userScrolledUp = false;
    
    // Add user message
    this.addMessage('user', message);
    this.chatInput.value = '';
    
    // Show loading
    this.isLoading = true;
    this.chatSend.disabled = true;
    this.showLoading();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: SITE_ID,
          message,
          conversationHistory: this.conversationHistory.slice(-10), // Last 10 messages
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Remove loading
      this.removeLoading();
      
      // Add AI response
      this.addMessage('assistant', data.message);
      
      // Display recommended products in chat
      if (data.recommendedProducts && data.recommendedProducts.length > 0) {
        this.addProductMessage(data.recommendedProducts);
      }
      
    } catch (error) {
      console.error('Chat Error:', error);
      this.removeLoading();
      this.addMessage('assistant', 'Üzgünüm, bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
    } finally {
      this.isLoading = false;
      this.chatSend.disabled = false;
      this.chatInput.focus();
    }
  }
}

// Initialize chat widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChatWidget();
});
