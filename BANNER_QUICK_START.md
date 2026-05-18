
## 🚀 Quick Setup

### 1. Create Your First Banner

```bash
curl -X POST "http://localhost:5000/banner" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "My First Banner",
    "title": "Welcome to Our Store",
    "subtitle": "Shop the Latest Fashion",
    "platform": "both",
    "page": "home",
    "actionType": "url",
    "actionUrl": "/products",
    "displayOrder": 1,
    "isActive": true,
    "buttonText": "Shop Now",
    "webDesktopUrl": "https://example.com/banner-desktop.jpg",
    "mobileUrl": "https://example.com/banner-mobile.jpg"
  }'
```

### 2. Get Banners for a Page

```bash
# Get all home page banners for mobile
curl "http://localhost:5000/banner/page/home?platform=mobile"

# Get all home page banners for web
curl "http://localhost:5000/banner/page/home?platform=web"
```

---

## 📋 Common Use Cases

### Use Case 1: Homepage Carousel (Mobile App)

```json
{
  "name": "App Launch Banner",
  "title": "Download Our App",
  "subtitle": "Get 10% Off",
  "platform": "mobile",
  "page": "home",
  "actionType": "page",
  "actionValue": "products",
  "displayOrder": 0,
  "buttonText": "Shop Now",
  "mobileUrl": "https://cdn.example.com/app-banner.jpg"
}
```

### Use Case 2: Product Promotion (Web)

```json
{
  "name": "Featured Product Banner",
  "title": "Trending Designer Dress",
  "subtitle": "Limited Stock Available",
  "platform": "web",
  "page": "products",
  "actionType": "product",
  "linkedProduct": "PRODUCT_ID",
  "displayOrder": 1,
  "buttonText": "Buy Now",
  "webDesktopUrl": "https://cdn.example.com/product-desktop.jpg",
  "webTabletUrl": "https://cdn.example.com/product-tablet.jpg"
}
```

### Use Case 3: Seasonal Sale (Both Platforms)

```json
{
  "name": "Summer Sale 2024",
  "title": "Summer Mega Sale",
  "subtitle": "Up to 70% Off",
  "platform": "both",
  "page": "home",
  "actionType": "url",
  "actionUrl": "/summer-sale",
  "displayOrder": 0,
  "startDate": "2024-06-01T00:00:00Z",
  "endDate": "2024-08-31T23:59:59Z",
  "buttonText": "Shop Sale",
  "buttonColor": "#FF6B6B",
  "textColor": "#FFFFFF",
  "tags": ["summer", "sale", "2024"],
  "webDesktopUrl": "https://cdn.example.com/summer-desktop.jpg",
  "mobileUrl": "https://cdn.example.com/summer-mobile.jpg"
}
```

### Use Case 4: Designer Spotlight

```json
{
  "name": "Designer of the Month",
  "title": "Featured Designer: Ritu Kumar",
  "subtitle": "Exclusive Collection",
  "platform": "both",
  "page": "designers",
  "actionType": "designer",
  "linkedDesigner": "DESIGNER_ID",
  "displayOrder": 1,
  "buttonText": "View Collection",
  "webDesktopUrl": "https://cdn.example.com/designer-desktop.jpg",
  "mobileUrl": "https://cdn.example.com/designer-mobile.jpg"
}
```

---

## 🎯 Platform-Specific Banners

### For Web Only
```json
{
  "platform": "web",
  "images": {
    "web": {
      "desktop": "url_for_desktop",
      "tablet": "url_for_tablet"
    }
  }
}
```

### For Mobile Only
```json
{
  "platform": "mobile",
  "images": {
    "mobile": "url_for_mobile"
  }
}
```

### For Both Platforms
```json
{
  "platform": "both",
  "images": {
    "web": {
      "desktop": "url_for_desktop",
      "tablet": "url_for_tablet"
    },
    "mobile": "url_for_mobile"
  }
}
```

---

## 📱 Page Types & Use Cases

| Page | Use For | Example |
|------|---------|---------|
| `home` | Main landing page | Welcome banners, seasonal sales |
| `products` | Product listing | Category promotions, filters |
| `categories` | Category pages | Category-specific offers |
| `designers` | Designer showcase | Designer highlights, collections |
| `checkout` | Checkout page | Free shipping, discount codes |
| `cart` | Shopping cart | Upsell, cross-sell products |
| `wishlist` | Wishlist page | Save later offers |
| `orders` | Order history | Reorder promotions |

---

## 🔗 Action Types Guide

### 1. No Action (Display Only)
```json
{
  "actionType": "none"
}
```
**Use for:** Informational banners, announcements

### 2. URL Link
```json
{
  "actionType": "url",
  "actionUrl": "/custom-page"
}
```
**Use for:** Custom landing pages, external links

### 3. Product Link
```json
{
  "actionType": "product",
  "linkedProduct": "product_id"
}
```
**Use for:** Product promotions, featured items

### 4. Category Link
```json
{
  "actionType": "category",
  "linkedCategory": "category_id"
}
```
**Use for:** Collection promotions, category sales

### 5. Designer Link
```json
{
  "actionType": "designer",
  "linkedDesigner": "designer_id"
}
```
**Use for:** Designer spotlights, brand campaigns

### 6. Page Navigation
```json
{
  "actionType": "page",
  "actionValue": "products"
}
```
**Use for:** Internal app navigation

---

## 📊 Analytics & Tracking

### Track Impression (When Banner is Viewed)
```javascript
// Frontend code
fetch(`/banner/${bannerId}/impression`, { method: 'POST' });
```

### Track Click (When Banner is Clicked)
```javascript
// Frontend code
fetch(`/banner/${bannerId}/click`, { method: 'POST' });
```

### Get Analytics
```bash
curl "http://localhost:5000/banner/BANNER_ID/analytics" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "bannerId": "123",
  "name": "Summer Sale",
  "clickCount": 250,
  "impressionCount": 5000,
  "clickThroughRate": "5.00%"
}
```

---

## 🎨 Customization Options

### Button Styling
```json
{
  "buttonText": "Shop Now",
  "buttonColor": "#FF6B6B",    // Button background color
  "textColor": "#FFFFFF"        // Button text color
}
```

### Display Order
```json
{
  "displayOrder": 0  // Lower numbers appear first
}
```
**Tip:** Use intervals of 10 (0, 10, 20) for easier reordering

### Scheduling
```json
{
  "startDate": "2024-06-01T00:00:00Z",  // Banner starts appearing
  "endDate": "2024-08-31T23:59:59Z"      // Banner stops appearing
}
```
**Note:** Leave `null` for always-active banners

### Tags
```json
{
  "tags": ["summer", "sale", "featured", "2024"]
}
```
**Use for:** Organization, filtering, search

---

## ⚡ Quick Operations

### 1. Activate/Deactivate Banner
```bash
curl -X PATCH "http://localhost:5000/banner/BANNER_ID/toggle" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. Update Banner
```bash
curl -X PUT "http://localhost:5000/banner/BANNER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "title": "Updated Title",
    "isActive": true
  }'
```

### 3. Delete Banner
```bash
curl -X DELETE "http://localhost:5000/banner/BANNER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. Reorder Banners
```bash
curl -X POST "http://localhost:5000/banner/reorder" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "banners": [
      { "bannerId": "ID1", "displayOrder": 0 },
      { "bannerId": "ID2", "displayOrder": 1 },
      { "bannerId": "ID3", "displayOrder": 2 }
    ]
  }'
```

---

## 🔍 Query & Filter

### Filter by Page & Platform
```bash
GET /banner?page=home&platform=mobile&isActive=true
```

### Sort & Paginate
```bash
GET /banner?sortBy=displayOrder&sortOrder=asc&limit=10&skip=0
```

### Get Active Banners Only
```bash
GET /banner?isActive=true
```

---

## 💡 Best Practices

### ✅ DO
- Use different images for different screen sizes
- Set appropriate display orders (0, 10, 20, ...)
- Schedule seasonal banners in advance
- Track analytics regularly
- Keep banner count per page to 3-5
- Use clear, action-oriented button text
- Optimize images before uploading

### ❌ DON'T
- Don't use same image for all platforms
- Don't leave banners without end dates for limited offers
- Don't forget to deactivate expired banners
- Don't use too many banners on one page
- Don't use vague button text like "Click Here"
- Don't upload uncompressed large images

---

## 🐛 Troubleshooting

### Banner Not Showing?
1. Check `isActive` is `true`
2. Verify `startDate` and `endDate` are correct
3. Confirm `platform` matches your request
4. Ensure `page` is correct

### Images Not Loading?
1. Verify image URLs are accessible
2. Check CORS settings
3. Ensure images are in correct format
4. Validate image URLs are HTTPS

### Analytics Not Tracking?
1. Ensure impression/click endpoints are called
2. Check network requests in browser
3. Verify banner ID is correct
4. Check for CORS errors

---

## 📞 API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/banner` | No | Get all banners |
| GET | `/banner/page/:page` | No | Get banners by page |
| GET | `/banner/:id` | No | Get single banner |
| POST | `/banner/:id/click` | No | Track click |
| POST | `/banner/:id/impression` | No | Track impression |
| POST | `/banner` | Yes | Create banner |
| PUT | `/banner/:id` | Yes | Update banner |
| DELETE | `/banner/:id` | Yes | Delete banner |
| PATCH | `/banner/:id/toggle` | Yes | Toggle status |
| POST | `/banner/reorder` | Yes | Reorder banners |
| GET | `/banner/:id/analytics` | Yes | Get analytics |

---

## 🚦 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## 📚 Additional Resources

- Full API Documentation: `BANNER_API_DOCUMENTATION.md`
- Test Examples: `test_banner_api.curl`
- Model Schema: `src/models/bannerModel.js`
- Controller Logic: `src/controllers/bannerController.js`
- Routes: `src/routes/bannerRoutes.js`

---

**Happy Banner Building! 🎉**

