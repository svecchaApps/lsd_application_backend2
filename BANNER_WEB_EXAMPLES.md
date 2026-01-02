# Web Banner Creation Examples


### Basic Hero Banner
```json
{
  "name": "Summer Collection 2024 Hero",
  "title": "Summer Collection 2024",
  "subtitle": "Up to 50% Off on All Items",
  "description": "Discover the latest summer fashion trends",
  "platform": "web",
  "page": "home",
  "actionType": "url",
  "actionUrl": "/collections/summer-2024",
  "displayOrder": 0,
  "isActive": true,
  "buttonText": "Shop Now",
  "buttonColor": "#FF6B6B",
  "textColor": "#FFFFFF",
  "tags": ["summer", "sale", "2024", "hero"],
  "webDesktopUrl": "https://cdn.example.com/banners/summer-hero-desktop-1920x600.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/summer-hero-tablet-1024x400.jpg",
  "imageUrl": "https://cdn.example.com/banners/summer-hero-desktop-1920x600.jpg"
}
```

### cURL Command
```bash
curl -X POST "http://localhost:5000/banner" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Summer Collection 2024 Hero",
    "title": "Summer Collection 2024",
    "subtitle": "Up to 50% Off on All Items",
    "description": "Discover the latest summer fashion trends",
    "platform": "web",
    "page": "home",
    "actionType": "url",
    "actionUrl": "/collections/summer-2024",
    "displayOrder": 0,
    "isActive": true,
    "buttonText": "Shop Now",
    "buttonColor": "#FF6B6B",
    "textColor": "#FFFFFF",
    "tags": ["summer", "sale", "2024", "hero"],
    "webDesktopUrl": "https://cdn.example.com/banners/summer-hero-desktop-1920x600.jpg",
    "webTabletUrl": "https://cdn.example.com/banners/summer-hero-tablet-1024x400.jpg",
    "imageUrl": "https://cdn.example.com/banners/summer-hero-desktop-1920x600.jpg"
  }'
```

---

## Example 2: Product Linked Banner

### Featured Product Banner
```json
{
  "name": "Featured Designer Dress Web Banner",
  "title": "Product of the Week",
  "subtitle": "Exclusive Designer Saree - Limited Edition",
  "description": "Hand-crafted silk saree with intricate embroidery",
  "platform": "web",
  "page": "products",
  "actionType": "product",
  "linkedProduct": "68ccf8d9c585b659b38bc7ed",
  "displayOrder": 1,
  "isActive": true,
  "buttonText": "Buy Now",
  "buttonColor": "#2D3748",
  "textColor": "#FFFFFF",
  "tags": ["featured", "product", "designer", "saree"],
  "webDesktopUrl": "https://cdn.example.com/banners/featured-product-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/featured-product-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/featured-product-desktop.jpg"
}
```

### cURL Command
```bash
curl -X POST "http://localhost:5000/banner" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Featured Designer Dress Web Banner",
    "title": "Product of the Week",
    "subtitle": "Exclusive Designer Saree - Limited Edition",
    "description": "Hand-crafted silk saree with intricate embroidery",
    "platform": "web",
    "page": "products",
    "actionType": "product",
    "linkedProduct": "68ccf8d9c585b659b38bc7ed",
    "displayOrder": 1,
    "isActive": true,
    "buttonText": "Buy Now",
    "buttonColor": "#2D3748",
    "textColor": "#FFFFFF",
    "tags": ["featured", "product", "designer", "saree"],
    "webDesktopUrl": "https://cdn.example.com/banners/featured-product-desktop.jpg",
    "webTabletUrl": "https://cdn.example.com/banners/featured-product-tablet.jpg",
    "imageUrl": "https://cdn.example.com/banners/featured-product-desktop.jpg"
  }'
```

---

## Example 3: Category Promotion Banner

### Category Banner with Link
```json
{
  "name": "Ethnic Wear Collection Web",
  "title": "Ethnic Wear Collection",
  "subtitle": "Traditional Meets Contemporary",
  "description": "Explore our curated collection of ethnic wear",
  "platform": "web",
  "page": "categories",
  "actionType": "category",
  "linkedCategory": "60d5ec49f1b2c72b8c8e4a1b",
  "displayOrder": 0,
  "isActive": true,
  "buttonText": "Explore Collection",
  "buttonColor": "#4ECDC4",
  "textColor": "#FFFFFF",
  "tags": ["ethnic", "traditional", "category", "collection"],
  "webDesktopUrl": "https://cdn.example.com/banners/ethnic-collection-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/ethnic-collection-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/ethnic-collection-desktop.jpg"
}
```

---

## Example 4: Designer Spotlight Banner

### Designer Featured Banner
```json
{
  "name": "Featured Designer Ritu Kumar Web",
  "title": "Designer Spotlight",
  "subtitle": "Ritu Kumar - Exclusive Collection",
  "description": "Shop the latest collection from renowned designer Ritu Kumar",
  "platform": "web",
  "page": "designers",
  "actionType": "designer",
  "linkedDesigner": "60d5ec49f1b2c72b8c8e4a2c",
  "displayOrder": 0,
  "isActive": true,
  "buttonText": "View Designer Collection",
  "buttonColor": "#8B5CF6",
  "textColor": "#FFFFFF",
  "tags": ["designer", "ritu-kumar", "exclusive", "spotlight"],
  "webDesktopUrl": "https://cdn.example.com/banners/ritu-kumar-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/ritu-kumar-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/ritu-kumar-desktop.jpg"
}
```

---

## Example 5: Scheduled Sale Banner

### Black Friday Sale (Scheduled)
```json
{
  "name": "Black Friday Mega Sale 2024 Web",
  "title": "Black Friday Mega Sale",
  "subtitle": "70% Off Everything",
  "description": "The biggest sale of the year - Limited time only",
  "platform": "web",
  "page": "home",
  "actionType": "url",
  "actionUrl": "/black-friday-deals",
  "displayOrder": 0,
  "isActive": true,
  "startDate": "2024-11-25T00:00:00.000Z",
  "endDate": "2024-11-30T23:59:59.999Z",
  "buttonText": "Shop Black Friday Deals",
  "buttonColor": "#000000",
  "textColor": "#FFD700",
  "tags": ["black-friday", "sale", "2024", "mega-sale", "limited"],
  "webDesktopUrl": "https://cdn.example.com/banners/black-friday-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/black-friday-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/black-friday-desktop.jpg"
}
```

---

## Example 6: Free Shipping Banner (Checkout Page)

### Promotional Banner
```json
{
  "name": "Free Shipping Offer Web",
  "title": "Free Shipping on Orders Above ₹999",
  "subtitle": "No Minimum Order - Limited Time",
  "description": "Get free shipping on all orders above ₹999",
  "platform": "web",
  "page": "checkout",
  "actionType": "none",
  "displayOrder": 0,
  "isActive": true,
  "buttonText": "Learn More",
  "buttonColor": "#10B981",
  "textColor": "#FFFFFF",
  "tags": ["free-shipping", "promotion", "checkout"],
  "webDesktopUrl": "https://cdn.example.com/banners/free-shipping-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/free-shipping-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/free-shipping-desktop.jpg"
}
```

---

## Example 7: New Arrivals Banner

### Latest Products Banner
```json
{
  "name": "New Arrivals This Week Web",
  "title": "New Arrivals",
  "subtitle": "Fresh Styles Added Daily",
  "description": "Check out the latest additions to our collection",
  "platform": "web",
  "page": "products",
  "actionType": "url",
  "actionUrl": "/products?sort=newest",
  "displayOrder": 2,
  "isActive": true,
  "buttonText": "See What's New",
  "buttonColor": "#F59E0B",
  "textColor": "#FFFFFF",
  "tags": ["new-arrivals", "latest", "fresh"],
  "webDesktopUrl": "https://cdn.example.com/banners/new-arrivals-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/new-arrivals-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/new-arrivals-desktop.jpg"
}
```

---

## Example 8: Seasonal Campaign Banner

### Festive Season Banner
```json
{
  "name": "Diwali Special Collection Web",
  "title": "Diwali Special Collection",
  "subtitle": "Celebrate in Style",
  "description": "Exclusive festive wear for the season of lights",
  "platform": "web",
  "page": "home",
  "actionType": "url",
  "actionUrl": "/collections/diwali-special",
  "displayOrder": 1,
  "isActive": true,
  "startDate": "2024-10-15T00:00:00.000Z",
  "endDate": "2024-11-15T23:59:59.999Z",
  "buttonText": "Shop Festive Collection",
  "buttonColor": "#DC2626",
  "textColor": "#FFFFFF",
  "tags": ["diwali", "festive", "seasonal", "2024"],
  "webDesktopUrl": "https://cdn.example.com/banners/diwali-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/diwali-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/diwali-desktop.jpg"
}
```

---

## Example 9: Minimal Banner (No Action)

### Informational Banner
```json
{
  "name": "Brand Story Web Banner",
  "title": "Crafted with Love",
  "subtitle": "Handpicked Designs by Expert Artisans",
  "description": "Every piece tells a story",
  "platform": "web",
  "page": "about",
  "actionType": "none",
  "displayOrder": 0,
  "isActive": true,
  "buttonText": "",
  "buttonColor": "#6B7280",
  "textColor": "#FFFFFF",
  "tags": ["brand", "story", "artisan"],
  "webDesktopUrl": "https://cdn.example.com/banners/brand-story-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/brand-story-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/brand-story-desktop.jpg"
}
```

---

## Example 10: Page Navigation Banner

### Internal Navigation Banner
```json
{
  "name": "Visit Our Designers Web",
  "title": "Meet Our Designers",
  "subtitle": "Discover Talented Fashion Creators",
  "description": "Explore collections from India's finest designers",
  "platform": "web",
  "page": "home",
  "actionType": "page",
  "actionValue": "designers",
  "displayOrder": 3,
  "isActive": true,
  "buttonText": "Explore Designers",
  "buttonColor": "#7C3AED",
  "textColor": "#FFFFFF",
  "tags": ["designers", "navigation", "explore"],
  "webDesktopUrl": "https://cdn.example.com/banners/designers-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/banners/designers-tablet.jpg",
  "imageUrl": "https://cdn.example.com/banners/designers-desktop.jpg"
}
```

---

## 📏 Recommended Image Dimensions for Web

### Desktop Images
- **Width**: 1920px
- **Height**: 600px
- **Format**: JPG, PNG, or WebP
- **Size**: < 300KB (optimized)

### Tablet Images
- **Width**: 1024px
- **Height**: 400px
- **Format**: JPG, PNG, or WebP
- **Size**: < 150KB (optimized)

---

## 🎨 Color Scheme Examples

### Recommended Button Colors
```json
{
  "Primary": "#FF6B6B",      // Coral Red
  "Success": "#10B981",      // Green
  "Warning": "#F59E0B",      // Amber
  "Info": "#3B82F6",         // Blue
  "Dark": "#2D3748",         // Dark Gray
  "Purple": "#8B5CF6",       // Purple
  "Teal": "#4ECDC4",         // Teal
  "Black": "#000000",        // Black
  "Gold": "#FFD700"          // Gold
}
```

### Text Color Options
```json
{
  "White": "#FFFFFF",
  "Black": "#000000",
  "Gray": "#6B7280",
  "Light Gray": "#F3F4F6"
}
```

---

## 📝 Field Explanations

### Required Fields
- `name` - Internal banner name (for admin reference)
- `platform` - "web" for web-only banners
- `page` - Which page to display on

### Optional but Recommended
- `title` - Main heading text on banner
- `subtitle` - Supporting text
- `description` - Detailed description
- `actionType` - What happens when clicked
- `displayOrder` - Display sequence (0 = first)
- `isActive` - Banner visibility status
- `buttonText` - CTA button text
- `buttonColor` - Button background color
- `textColor` - Button text color
- `tags` - For organization and filtering

### Image URLs
- `webDesktopUrl` - Desktop image (1920x600px)
- `webTabletUrl` - Tablet image (1024x400px)
- `imageUrl` - Fallback/legacy image

### Action Fields (based on actionType)
- `actionUrl` - For `actionType: "url"`
- `linkedProduct` - For `actionType: "product"`
- `linkedCategory` - For `actionType: "category"`
- `linkedDesigner` - For `actionType: "designer"`
- `actionValue` - For `actionType: "page"`

### Scheduling (Optional)
- `startDate` - When banner becomes active
- `endDate` - When banner becomes inactive

---

## 🚀 Quick Test Command

### Create a Simple Web Banner
```bash
curl -X POST "http://localhost:5000/banner" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Test Web Banner",
    "title": "Welcome to Our Store",
    "subtitle": "Shop the Latest Fashion",
    "platform": "web",
    "page": "home",
    "actionType": "url",
    "actionUrl": "/products",
    "displayOrder": 0,
    "isActive": true,
    "buttonText": "Shop Now",
    "buttonColor": "#FF6B6B",
    "textColor": "#FFFFFF",
    "webDesktopUrl": "https://via.placeholder.com/1920x600",
    "webTabletUrl": "https://via.placeholder.com/1024x400",
    "imageUrl": "https://via.placeholder.com/1920x600"
  }'
```

---

## ✅ Success Response Example

```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "name": "Summer Collection 2024 Hero",
    "title": "Summer Collection 2024",
    "subtitle": "Up to 50% Off on All Items",
    "platform": "web",
    "page": "home",
    "actionType": "url",
    "actionUrl": "/collections/summer-2024",
    "displayOrder": 0,
    "isActive": true,
    "buttonText": "Shop Now",
    "buttonColor": "#FF6B6B",
    "textColor": "#FFFFFF",
    "images": {
      "web": {
        "desktop": "https://cdn.example.com/banners/summer-hero-desktop-1920x600.jpg",
        "tablet": "https://cdn.example.com/banners/summer-hero-tablet-1024x400.jpg"
      },
      "mobile": ""
    },
    "tags": ["summer", "sale", "2024", "hero"],
    "clickCount": 0,
    "impressionCount": 0,
    "createdDate": "2024-01-15T10:30:00.000Z",
    "updatedDate": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 🔍 Tips for Web Banners

1. **Image Quality**: Use high-resolution images (1920x600px for desktop)
2. **File Size**: Optimize images to < 300KB for fast loading
3. **Responsive**: Always provide both desktop and tablet images
4. **Colors**: Ensure good contrast between button color and text color
5. **Text**: Keep title concise (max 50 characters)
6. **Action**: Always set an actionType for better UX
7. **Testing**: Test on different screen sizes
8. **Scheduling**: Use startDate/endDate for time-sensitive campaigns

---

**Ready to create your web banners!** 🎨

