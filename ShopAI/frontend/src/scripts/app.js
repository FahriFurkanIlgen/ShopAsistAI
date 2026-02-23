// ShopAsistAI Frontend Application - Embeddable Widget
// Configuration from parent page
const widgetConfig = window.ShopAsistConfig || {};
const API_BASE_URL = widgetConfig.apiUrl || 'http://localhost:3000';
const SITE_ID = widgetConfig.siteId || 'high5-tr';

// Get root element (Shadow DOM or document)
const getRoot = () => {
  return window.__shopAsistShadowRoot || document;
};

class ChatWidget {
  constructor() {
    // Set root to either Shadow DOM or regular document
    this.root = getRoot();
    
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
    this.chatToggle = this.root.getElementById('chat-toggle');
    this.chatWindow = this.root.getElementById('chat-window');
    this.chatClose = this.root.getElementById('chat-close');
    this.chatContent = this.root.querySelector('.chat-content'); // Scrollable container
    this.chatMessages = this.root.getElementById('chat-messages');
    this.chatInput = this.root.getElementById('chat-input');
    this.chatSend = this.root.getElementById('chat-send');
    this.productSuggestions = this.root.getElementById('product-suggestions');
    this.chatTitle = this.root.getElementById('chat-title');
    this.chatLogo = this.root.getElementById('chat-logo');
    this.welcomeMessage = this.root.getElementById('welcome-message');
    this.welcomeSubtext = this.root.getElementById('welcome-subtext');
    this.welcomeSection = this.root.getElementById('welcome-section');
    this.categorySection = this.root.getElementById('category-section');
    this.categoryButtons = this.root.getElementById('category-buttons');
    this.privacyFooter = this.root.getElementById('privacy-footer');
    this.privacyLink = this.root.getElementById('privacy-link');
    this.closePrivacy = this.root.getElementById('close-privacy');
    this.brandingFooter = this.root.getElementById('branding-footer');
    this.brandingText = this.root.getElementById('branding-text');
    
    if (this.closePrivacy) {
      this.closePrivacy.addEventListener('click', () => {
        this.privacyFooter.style.display = 'none';
      });
    }
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

    // Apply colors to Shadow DOM or document
    const styleTarget = this.root === document ? document.documentElement : this.root.host;
    if (this.config.primaryColor && styleTarget) {
      styleTarget.style.setProperty('--brand-primary', this.config.primaryColor);
    }
    if (this.config.secondaryColor && styleTarget) {
      styleTarget.style.setProperty('--brand-secondary', this.config.secondaryColor);
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
    const categoryName = btn.querySelector('span:last-child').textContent;
    const keywords = btn.dataset.keywords.split(',').filter((k) => k);

    // Toggle active state
    this.categoryButtons.querySelectorAll('.category-btn').forEach((b) => {
      b.classList.remove('active');
    });
    btn.classList.add('active');

    this.selectedCategory = { id: categoryId, name: categoryName };

    // User clicked category, so they want to see results - enable auto-scroll
    this.userScrolledUp = false;

    // Fetch products for this category
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${SITE_ID}/category?keywords=${encodeURIComponent(keywords.join(','))}`
      );
      const data = await response.json();

      if (data.recommendedProducts && data.recommendedProducts.length > 0) {
        this.addProductMessage(data.recommendedProducts, `${this.selectedCategory.name} kategorisinde sizin için seçtiklerim:`);
        
        // Hide welcome section after category selection
        if (this.conversationHistory.length === 0) {
          this.welcomeSection.style.display = 'none';
        }
        
        // Scroll to show the products
        this.scrollToBottom();
      }
    } catch (error) {
      console.error('Error fetching category products:', error);
    }
  }

  attachEventListeners() {
    this.chatToggle.addEventListener('click', () => this.toggleChat());
    this.chatClose.addEventListener('click', () => this.toggleChat());
    this.chatSend.addEventListener('click', () => this.sendMessage());
    
    // Auto-resize textarea as user types
    this.chatInput.addEventListener('input', () => {
      this.autoResizeTextarea();
    });
    
    // Handle Enter key (Shift+Enter for new line, Enter to send)
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !this.isLoading) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Track user scroll behavior on the CORRECT scrollable container
    this.chatContent.addEventListener('scroll', () => {
      this.checkScrollPosition();
    });
  }
  
  checkScrollPosition() {
    const container = this.chatContent; // Use chat-content, not chat-messages
    const threshold = 50; // 50px tolerance
    
    // Check if user is near bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    
    // Update flag: true if user scrolled up (not at bottom)
    this.userScrolledUp = !isNearBottom;
  }

  autoResizeTextarea() {
    // Reset height to auto to get the correct scrollHeight
    this.chatInput.style.height = 'auto';
    
    // Set new height based on content (with max-height handled by CSS)
    const newHeight = Math.min(this.chatInput.scrollHeight, 120);
    this.chatInput.style.height = newHeight + 'px';
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
    
    // Add to history immediately
    this.conversationHistory.push({
      role: role === 'user' ? 'user' : 'assistant',
      content,
      timestamp: new Date(),
    });
    
    // For assistant messages, use typing effect
    if (role === 'assistant') {
      messageDiv.appendChild(p);
      this.chatMessages.appendChild(messageDiv);
      
      // Return promise from typing animation
      return this.typeMessage(p, content);
    } else {
      // User messages appear instantly
      p.textContent = content;
      messageDiv.appendChild(p);
      this.chatMessages.appendChild(messageDiv);
      this.scrollToBottomIfNeeded();
      
      // Return resolved promise for consistency
      return Promise.resolve();
    }
  }

  typeMessage(element, text, speed = 25) {
    return new Promise((resolve) => {
      let index = 0;
      element.textContent = '';
      
      const type = () => {
        if (index < text.length) {
          element.textContent += text.charAt(index);
          index++;
          
          // Smooth scroll during typing
          this.scrollToBottomIfNeeded();
          
          // Continue typing
          setTimeout(type, speed);
        } else {
          // Typing finished
          resolve();
        }
      };
      
      type();
    });
  }

  typeMessageWithCallback(element, text, speed = 25, callback) {
    let index = 0;
    element.textContent = '';
    
    const type = () => {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        
        // Smooth scroll during typing
        this.scrollToBottomIfNeeded();
        
        // Continue typing
        setTimeout(type, speed);
      } else {
        // Typing finished, call callback
        if (callback) {
          setTimeout(callback, 100);
        }
      }
    };
    
    type();
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
      this.chatContent.scrollTo({
        top: this.chatContent.scrollHeight,
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
    const loadingMsg = this.root.getElementById('loading-message');
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
    
    // Add intro text with typing effect
    const introP = document.createElement('p');
    messageDiv.appendChild(introP);
    
    // Add products container (initially hidden)
    const productsContainer = document.createElement('div');
    productsContainer.className = 'products-in-message';
    productsContainer.style.display = 'none'; // Hide until text finishes
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
    
    // Type the intro text, then show products
    this.typeMessageWithCallback(introP, text, 25, () => {
      // After typing completes, show products with animation
      productsContainer.style.display = 'flex';
      productsContainer.style.opacity = '0';
      setTimeout(() => {
        productsContainer.style.transition = 'opacity 0.4s ease';
        productsContainer.style.opacity = '1';
        this.scrollToBottomIfNeeded();
      }, 50);
    });
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
    this.autoResizeTextarea(); // Reset textarea height
    
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
      
      // Add AI response and wait for typing to finish
      await this.addMessage('assistant', data.message);
      
      // Display recommended products AFTER message typing completes
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
