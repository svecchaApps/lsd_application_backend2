# Get Stylists by Category API Documentation

This document describes the endpoint to get stylists filtered by category with various filters including price range.

## Base URL

- **Development**: `http://localhost:5000`
- **Production**: `https://your-production-url.com`

All endpoints are prefixed with `/stylist`.

---

## Get Stylists by Category

**Endpoint**: `GET /stylist/category/:categoryId`  
**Authentication**: Not required (Public endpoint)  
**Description**: Get approved stylists in a specific category with filters (location, rating, price range) and sorting options.

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categoryId` | String/ObjectId | Yes | Category ID |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | `1` | Page number for pagination |
| `limit` | Number | No | `10` | Number of results per page (max: 100) |
| `city` | String | No | `''` | Filter by city name (case-insensitive) |
| `state` | String | No | `''` | Filter by state name (case-insensitive) |
| `minRating` | Number | No | `0` | Minimum rating filter (0-5) |
| `minPrice` | Number | No | `null` | Minimum price filter |
| `maxPrice` | Number | No | `null` | Maximum price filter |
| `specialty` | String | No | — | One specialty; repeat for multiple values |
| `specialties` | String | No | — | Comma-separated list; stylist matches if any value equals an entry in **`specialties`** or **`stylistSkills`** (case-insensitive) |
| `sortBy` | String | No | `'stylistRating'` | Field to sort by |
| `sortOrder` | String | No | `'desc'` | Sort order: 'asc' or 'desc' |

Label list for filters: **`GET /stylist/specialties`**.

### Sort Fields

Available fields for sorting (`sortBy` parameter):
- `stylistRating` - Sort by rating (default)
- `stylistPrice` - Sort by price
- `stylistName` - Sort alphabetically by name
- `createdAt` - Sort by creation date

### Request Example

```bash
GET /stylist/category/507f1f77bcf86cd799439011?city=Mumbai&minPrice=1000&maxPrice=5000&minRating=4.0&sortBy=stylistPrice&sortOrder=asc&page=1&limit=10
```

### Response Format

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Stylists in category 'Hair Styling' retrieved successfully",
  "data": {
    "category": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Hair Styling",
      "description": "Professional hair styling services",
      "image": "https://example.com/category.jpg",
      "icon": "scissors"
    },
    "stylists": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "stylistName": "Sarah's Fashion Studio",
        "stylistEmail": "sarah@example.com",
        "stylistPhone": "+919876543210",
        "stylistImage": "https://example.com/image.jpg",
        "stylistBio": "Professional hair stylist with 10 years of experience",
        "stylistCity": "Mumbai",
        "stylistState": "Maharashtra",
        "stylistPrice": 2000,
        "stylistRating": 4.5,
        "stylistCategories": [
          {
            "_id": "507f1f77bcf86cd799439011",
            "name": "Hair Styling",
            "description": "Professional hair styling services",
            "image": "https://example.com/category.jpg",
            "icon": "scissors"
          }
        ],
        "stylistExperience": "10 years",
        "stylistEducation": "Fashion Design Degree",
        "stylistSkills": ["Hair Cutting", "Coloring", "Styling"],
        "userId": {
          "_id": "507f1f77bcf86cd799439013",
          "displayName": "Sarah Johnson",
          "email": "sarah@example.com",
          "phoneNumber": "+919876543210",
          "profilePicture": "https://example.com/profile.jpg"
        },
        "isApproved": true,
        "approvalStatus": "approved",
        "applicationStatus": "approved",
        "createdAt": "2024-01-01T10:00:00.000Z",
        "updatedAt": "2024-01-15T14:30:00.000Z"
      }
    ],
    "filters": {
      "city": "Mumbai",
      "state": null,
      "minRating": 4.0,
      "minPrice": 1000,
      "maxPrice": 5000,
      "sortBy": "stylistPrice",
      "sortOrder": "asc"
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalStylists": 25,
      "limit": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid category ID format
```json
{
  "success": false,
  "message": "Invalid category ID format"
}
```

**400 Bad Request** - Invalid pagination parameters
```json
{
  "success": false,
  "message": "Invalid page number. Must be a positive integer"
}
```

**404 Not Found** - Category not found
```json
{
  "success": false,
  "message": "Category not found or inactive"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Error retrieving stylists by category",
  "error": "Error message details"
}
```

---

## Usage Examples

### 1. Basic - Get Stylists by Category

Get all stylists in a category (first page):

```bash
GET /stylist/category/507f1f77bcf86cd799439011
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/category/507f1f77bcf86cd799439011"
```

---

### 2. With Location Filter

Get stylists in a category from a specific city:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?city=Mumbai
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/category/507f1f77bcf86cd799439011?city=Mumbai"
```

---

### 3. With Price Range Filter

Get stylists in a category within a price range:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?minPrice=1000&maxPrice=5000
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/category/507f1f77bcf86cd799439011?minPrice=1000&maxPrice=5000"
```

---

### 4. With Rating Filter

Get highly rated stylists in a category:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?minRating=4.0
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/category/507f1f77bcf86cd799439011?minRating=4.0"
```

---

### 5. With Multiple Filters

Combine multiple filters:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?city=Mumbai&state=Maharashtra&minRating=4.0&minPrice=1000&maxPrice=5000
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/category/507f1f77bcf86cd799439011?city=Mumbai&state=Maharashtra&minRating=4.0&minPrice=1000&maxPrice=5000"
```

---

### 6. With Sorting

Sort by price (lowest first):

```bash
GET /stylist/category/507f1f77bcf86cd799439011?sortBy=stylistPrice&sortOrder=asc
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/category/507f1f77bcf86cd799439011?sortBy=stylistPrice&sortOrder=asc"
```

---

### 7. With Pagination

Get second page of results:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?page=2&limit=20
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/category/507f1f77bcf86cd799439011?page=2&limit=20"
```

---

### 8. Complete Example

Full-featured request with all filters and sorting:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?city=Mumbai&state=Maharashtra&minRating=4.0&minPrice=1000&maxPrice=5000&sortBy=stylistPrice&sortOrder=asc&page=1&limit=10
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/category/507f1f77bcf86cd799439011?city=Mumbai&state=Maharashtra&minRating=4.0&minPrice=1000&maxPrice=5000&sortBy=stylistPrice&sortOrder=asc&page=1&limit=10"
```

---

## Price Filter Examples

### Minimum Price Only

Get stylists with price >= 2000:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?minPrice=2000
```

### Maximum Price Only

Get stylists with price <= 5000:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?maxPrice=5000
```

### Price Range

Get stylists with price between 1000 and 5000:

```bash
GET /stylist/category/507f1f77bcf86cd799439011?minPrice=1000&maxPrice=5000
```

### Price Range with Sorting

Get stylists in price range, sorted by price (lowest first):

```bash
GET /stylist/category/507f1f77bcf86cd799439011?minPrice=1000&maxPrice=5000&sortBy=stylistPrice&sortOrder=asc
```

---

## Filter Combinations

### Location + Price

```bash
GET /stylist/category/507f1f77bcf86cd799439011?city=Mumbai&minPrice=1000&maxPrice=5000
```

### Rating + Price

```bash
GET /stylist/category/507f1f77bcf86cd799439011?minRating=4.0&minPrice=2000&maxPrice=5000
```

### Location + Rating + Price

```bash
GET /stylist/category/507f1f77bcf86cd799439011?city=Mumbai&state=Maharashtra&minRating=4.0&minPrice=1000&maxPrice=5000
```

---

## Sorting Options

### Sort by Rating

```bash
# Highest rating first (default)
GET /stylist/category/507f1f77bcf86cd799439011?sortBy=stylistRating&sortOrder=desc

# Lowest rating first
GET /stylist/category/507f1f77bcf86cd799439011?sortBy=stylistRating&sortOrder=asc
```

### Sort by Price

```bash
# Lowest price first
GET /stylist/category/507f1f77bcf86cd799439011?sortBy=stylistPrice&sortOrder=asc

# Highest price first
GET /stylist/category/507f1f77bcf86cd799439011?sortBy=stylistPrice&sortOrder=desc
```

### Sort by Name

```bash
# Alphabetical (A-Z)
GET /stylist/category/507f1f77bcf86cd799439011?sortBy=stylistName&sortOrder=asc

# Reverse alphabetical (Z-A)
GET /stylist/category/507f1f77bcf86cd799439011?sortBy=stylistName&sortOrder=desc
```

---

## Client-Side Implementation Examples

### JavaScript/React

```javascript
// Get stylists by category with filters
const getStylistsByCategory = async (categoryId, filters = {}) => {
  const {
    page = 1,
    limit = 10,
    city = '',
    state = '',
    minRating = 0,
    minPrice = null,
    maxPrice = null,
    sortBy = 'stylistRating',
    sortOrder = 'desc'
  } = filters;

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    city,
    state,
    minRating: minRating.toString(),
    sortBy,
    sortOrder
  });

  if (minPrice !== null && minPrice !== undefined) {
    params.append('minPrice', minPrice.toString());
  }

  if (maxPrice !== null && maxPrice !== undefined) {
    params.append('maxPrice', maxPrice.toString());
  }

  try {
    const response = await fetch(`/stylist/category/${categoryId}?${params.toString()}`);
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error fetching stylists by category:', error);
    throw error;
  }
};

// Usage
const results = await getStylistsByCategory('507f1f77bcf86cd799439011', {
  city: 'Mumbai',
  minPrice: 1000,
  maxPrice: 5000,
  minRating: 4.0,
  sortBy: 'stylistPrice',
  sortOrder: 'asc',
  page: 1,
  limit: 10
});
```

### Flutter/Dart

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class StylistCategoryService {
  final String baseUrl;

  StylistCategoryService(this.baseUrl);

  Future<Map<String, dynamic>> getStylistsByCategory({
    required String categoryId,
    int page = 1,
    int limit = 10,
    String? city,
    String? state,
    double? minRating,
    double? minPrice,
    double? maxPrice,
    String sortBy = 'stylistRating',
    String sortOrder = 'desc',
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      'sortBy': sortBy,
      'sortOrder': sortOrder,
    };

    if (city != null && city.isNotEmpty) {
      params['city'] = city;
    }

    if (state != null && state.isNotEmpty) {
      params['state'] = state;
    }

    if (minRating != null && minRating > 0) {
      params['minRating'] = minRating.toString();
    }

    if (minPrice != null) {
      params['minPrice'] = minPrice.toString();
    }

    if (maxPrice != null) {
      params['maxPrice'] = maxPrice.toString();
    }

    final uri = Uri.parse('$baseUrl/stylist/category/$categoryId')
        .replace(queryParameters: params);

    try {
      final response = await http.get(uri);
      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        return data['data'];
      } else {
        throw Exception(data['message']);
      }
    } catch (e) {
      throw Exception('Failed to get stylists by category: $e');
    }
  }
}

// Usage
final categoryService = StylistCategoryService('http://localhost:5000');
final results = await categoryService.getStylistsByCategory(
  categoryId: '507f1f77bcf86cd799439011',
  city: 'Mumbai',
  minPrice: 1000,
  maxPrice: 5000,
  minRating: 4.0,
  sortBy: 'stylistPrice',
  sortOrder: 'asc',
  page: 1,
  limit: 10,
);
```

---

## Important Notes

### 1. Category Validation
- Category must exist and be active
- Only approved stylists in the category are returned
- Category ID must be a valid MongoDB ObjectId

### 2. Price Filters
- `minPrice`: Minimum price (inclusive)
- `maxPrice`: Maximum price (inclusive)
- Both can be used together for price range filtering
- Price is in the base currency (typically INR)

### 3. Approved Stylists Only
- Only stylists with `isApproved: true` are returned
- Stylists must have `approvalStatus: 'approved'`
- Stylists must have `applicationStatus: 'approved'`
- Stylists must have `bookingSettings.isAvailableForBooking: true`

### 4. Pagination
- Default page size: 10
- Maximum page size: 100
- Page numbers start at 1
- Limit must be between 1 and 100

### 5. Sorting
- Default sort: `stylistRating` descending
- Valid sort fields: `stylistRating`, `stylistPrice`, `stylistName`, `createdAt`
- Invalid sort fields default to `stylistRating`

### 6. Filter Logic
- All filters are combined with AND logic
- Location filters are case-insensitive
- Rating and price filters use numeric comparison

---

## Real-World Use Cases

### 1. User wants stylists in "Hair Styling" category in Mumbai

```bash
GET /stylist/category/507f1f77bcf86cd799439011?city=Mumbai
```

### 2. User filters by price range (1000-5000)

```bash
GET /stylist/category/507f1f77bcf86cd799439011?minPrice=1000&maxPrice=5000&sortBy=stylistPrice&sortOrder=asc
```

### 3. User wants highly rated stylists in price range

```bash
GET /stylist/category/507f1f77bcf86cd799439011?minRating=4.0&minPrice=2000&maxPrice=5000
```

### 4. User wants cheapest stylists in category

```bash
GET /stylist/category/507f1f77bcf86cd799439011?sortBy=stylistPrice&sortOrder=asc&limit=20
```

---

## Comparison with Other Endpoints

### `/stylist/category/:categoryId` vs `/stylist/search`

| Feature | `/stylist/category/:categoryId` | `/stylist/search` |
|---------|--------------------------------|-------------------|
| Category Filter | ✅ Required (path param) | ✅ Optional (query param) |
| Text Search | ❌ No text search | ✅ Full-text search |
| Price Range | ✅ minPrice + maxPrice | ✅ maxPrice only |
| Use Case | Browse category with filters | Search across all stylists |

### `/stylist/category/:categoryId` vs `/stylist/approved`

| Feature | `/stylist/category/:categoryId` | `/stylist/approved` |
|---------|--------------------------------|---------------------|
| Category Filter | ✅ Required | ✅ Optional |
| Price Range | ✅ minPrice + maxPrice | ✅ maxPrice only |
| Use Case | Category-specific browsing | General browsing with filters |

---

## Summary

The `/stylist/category/:categoryId` endpoint provides:
- ✅ Category-specific stylist filtering
- ✅ Price range filtering (minPrice + maxPrice)
- ✅ Location filtering (city, state)
- ✅ Rating filtering
- ✅ Multiple sorting options
- ✅ Pagination support
- ✅ Returns only approved stylists
- ✅ Public access (no authentication required)

Perfect for category pages with advanced filtering options!
