# Stylist Search API Documentation

This document describes the stylist search endpoint that allows users to search for stylists using text queries and various filters.

## Base URL

- **Development**: `http://localhost:5000`
- **Production**: `https://your-production-url.com`

All endpoints are prefixed with `/stylist`.

---

## Search Stylists

**Endpoint**: `GET /stylist/search`  
**Authentication**: Not required (Public endpoint)  
**Description**: Search for approved stylists using text queries and various filters. Returns only approved and available stylists.

### Request Parameters

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | String | No | `''` | Search query text (searches across multiple fields) |
| `page` | Number | No | `1` | Page number for pagination |
| `limit` | Number | No | `10` | Number of results per page |
| `city` | String | No | `''` | Filter by city name |
| `state` | String | No | `''` | Filter by state name |
| `minRating` | Number | No | `0` | Minimum rating filter (0-5) |
| `maxPrice` | Number | No | `null` | Maximum price filter |
| `category` | String | No | `''` | Filter by category name |
| `categoryId` | String/ObjectId | No | `''` | Filter by category ID |
| `sortBy` | String | No | `'stylistRating'` | Field to sort by |
| `sortOrder` | String | No | `'desc'` | Sort order: 'asc' or 'desc' |

### Search Fields

The search query (`q` parameter) searches across the following fields:
- **stylistName** - Stylist's name
- **stylistBio** - Stylist's biography/description
- **stylistCity** - City location
- **stylistState** - State location
- **stylistExperience** - Experience description
- **stylistEducation** - Education background
- **stylistSkills** - Array of skills

### Sort Fields

Available fields for sorting (`sortBy` parameter):
- `stylistRating` - Sort by rating (default)
- `stylistPrice` - Sort by price
- `stylistName` - Sort alphabetically by name
- `createdAt` - Sort by creation date

### Response Format

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Stylists searched successfully",
  "data": {
    "stylists": [
      {
        "_id": "507f1f77bcf86cd799439011",
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
            "_id": "507f1f77bcf86cd799439012",
            "name": "Hair Styling",
            "description": "Hair styling services",
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
        "bookingSettings": {
          "isAvailableForBooking": true
        },
        "isApproved": true,
        "approvalStatus": "approved",
        "applicationStatus": "approved",
        "createdAt": "2024-01-01T10:00:00.000Z",
        "updatedAt": "2024-01-15T14:30:00.000Z"
      }
    ],
    "searchQuery": "hair stylist",
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

#### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Error searching stylists",
  "error": "Error message details"
}
```

---

## Usage Examples

### 1. Basic Text Search

Search for stylists by name, bio, or skills:

```bash
GET /stylist/search?q=hair%20stylist
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=hair%20stylist"
```

### 2. Search with Location Filter

Search for stylists in a specific city:

```bash
GET /stylist/search?q=beauty&city=Mumbai
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=beauty&city=Mumbai"
```

### 3. Search with Rating Filter

Search for highly rated stylists:

```bash
GET /stylist/search?q=professional&minRating=4.0
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=professional&minRating=4.0"
```

### 4. Search with Price Filter

Search for stylists within a price range:

```bash
GET /stylist/search?q=stylist&maxPrice=5000
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=stylist&maxPrice=5000"
```

### 5. Search with Category

Search for stylists in a specific category:

```bash
GET /stylist/search?q=hair&categoryId=507f1f77bcf86cd799439011
```

Or by category name:

```bash
GET /stylist/search?q=hair&category=Hair%20Styling
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=hair&categoryId=507f1f77bcf86cd799439011"
```

### 6. Search with Multiple Filters

Combine multiple filters for refined results:

```bash
GET /stylist/search?q=professional&city=Mumbai&state=Maharashtra&minRating=4.0&maxPrice=5000&categoryId=507f1f77bcf86cd799439011
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=professional&city=Mumbai&state=Maharashtra&minRating=4.0&maxPrice=5000&categoryId=507f1f77bcf86cd799439011"
```

### 7. Search with Sorting

Search and sort by price (ascending):

```bash
GET /stylist/search?q=stylist&sortBy=stylistPrice&sortOrder=asc
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=stylist&sortBy=stylistPrice&sortOrder=asc"
```

### 8. Search with Pagination

Get second page of results:

```bash
GET /stylist/search?q=hair&page=2&limit=20
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=hair&page=2&limit=20"
```

### 9. Complete Example

Full-featured search with all parameters:

```bash
GET /stylist/search?q=professional%20hair%20stylist&city=Mumbai&state=Maharashtra&minRating=4.0&maxPrice=5000&categoryId=507f1f77bcf86cd799439011&sortBy=stylistRating&sortOrder=desc&page=1&limit=10
```

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/stylist/search?q=professional%20hair%20stylist&city=Mumbai&state=Maharashtra&minRating=4.0&maxPrice=5000&categoryId=507f1f77bcf86cd799439011&sortBy=stylistRating&sortOrder=desc&page=1&limit=10"
```

---

## Filter Combinations

### Location-Based Search

```bash
# Search in specific city
GET /stylist/search?city=Mumbai

# Search in specific state
GET /stylist/search?state=Maharashtra

# Search in city and state
GET /stylist/search?city=Mumbai&state=Maharashtra

# Text search with location
GET /stylist/search?q=hair&city=Mumbai&state=Maharashtra
```

### Rating-Based Search

```bash
# Minimum 4.0 rating
GET /stylist/search?minRating=4.0

# Text search with minimum rating
GET /stylist/search?q=professional&minRating=4.5
```

### Price-Based Search

```bash
# Maximum price 5000
GET /stylist/search?maxPrice=5000

# Text search with price filter
GET /stylist/search?q=stylist&maxPrice=3000
```

### Category-Based Search

```bash
# By category ID
GET /stylist/search?categoryId=507f1f77bcf86cd799439011

# By category name
GET /stylist/search?category=Hair%20Styling

# Text search with category
GET /stylist/search?q=hair&categoryId=507f1f77bcf86cd799439011
```

---

## Sorting Options

### Sort by Rating (Default)

```bash
# Highest rating first (default)
GET /stylist/search?q=stylist&sortBy=stylistRating&sortOrder=desc

# Lowest rating first
GET /stylist/search?q=stylist&sortBy=stylistRating&sortOrder=asc
```

### Sort by Price

```bash
# Lowest price first
GET /stylist/search?q=stylist&sortBy=stylistPrice&sortOrder=asc

# Highest price first
GET /stylist/search?q=stylist&sortBy=stylistPrice&sortOrder=desc
```

### Sort by Name

```bash
# Alphabetical (A-Z)
GET /stylist/search?q=stylist&sortBy=stylistName&sortOrder=asc

# Reverse alphabetical (Z-A)
GET /stylist/search?q=stylist&sortBy=stylistName&sortOrder=desc
```

### Sort by Creation Date

```bash
# Newest first
GET /stylist/search?q=stylist&sortBy=createdAt&sortOrder=desc

# Oldest first
GET /stylist/search?q=stylist&sortBy=createdAt&sortOrder=asc
```

---

## Pagination

### Basic Pagination

```bash
# Page 1 (default)
GET /stylist/search?q=stylist&page=1&limit=10

# Page 2
GET /stylist/search?q=stylist&page=2&limit=10

# Page 3
GET /stylist/search?q=stylist&page=3&limit=10
```

### Custom Page Size

```bash
# 20 results per page
GET /stylist/search?q=stylist&page=1&limit=20

# 50 results per page
GET /stylist/search?q=stylist&page=1&limit=50
```

---

## Real-World Use Cases

### 1. User searches for "hair stylist in Mumbai"

```bash
GET /stylist/search?q=hair%20stylist&city=Mumbai
```

### 2. User filters by rating and price

```bash
GET /stylist/search?minRating=4.0&maxPrice=5000&sortBy=stylistRating&sortOrder=desc
```

### 3. User searches by category and location

```bash
GET /stylist/search?category=Hair%20Styling&city=Mumbai&state=Maharashtra
```

### 4. User searches with all filters

```bash
GET /stylist/search?q=professional&city=Mumbai&state=Maharashtra&minRating=4.0&maxPrice=5000&categoryId=507f1f77bcf86cd799439011&sortBy=stylistRating&sortOrder=desc&page=1&limit=10
```

---

## Client-Side Implementation Examples

### JavaScript/React

```javascript
// Search stylists function
const searchStylists = async (searchParams) => {
  const {
    query = '',
    city = '',
    state = '',
    minRating = 0,
    maxPrice = null,
    categoryId = '',
    sortBy = 'stylistRating',
    sortOrder = 'desc',
    page = 1,
    limit = 10
  } = searchParams;

  const params = new URLSearchParams({
    q: query,
    city,
    state,
    minRating: minRating.toString(),
    sortBy,
    sortOrder,
    page: page.toString(),
    limit: limit.toString()
  });

  if (maxPrice) {
    params.append('maxPrice', maxPrice.toString());
  }

  if (categoryId) {
    params.append('categoryId', categoryId);
  }

  try {
    const response = await fetch(`/stylist/search?${params.toString()}`);
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

// Usage
const results = await searchStylists({
  query: 'hair stylist',
  city: 'Mumbai',
  minRating: 4.0,
  maxPrice: 5000,
  page: 1,
  limit: 10
});
```

### Flutter/Dart

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class StylistSearchService {
  final String baseUrl;

  StylistSearchService(this.baseUrl);

  Future<Map<String, dynamic>> searchStylists({
    String? query,
    String? city,
    String? state,
    double? minRating,
    double? maxPrice,
    String? categoryId,
    String sortBy = 'stylistRating',
    String sortOrder = 'desc',
    int page = 1,
    int limit = 10,
  }) async {
    final params = <String, String>{
      'q': query ?? '',
      'city': city ?? '',
      'state': state ?? '',
      'minRating': (minRating ?? 0).toString(),
      'sortBy': sortBy,
      'sortOrder': sortOrder,
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (maxPrice != null) {
      params['maxPrice'] = maxPrice.toString();
    }

    if (categoryId != null && categoryId.isNotEmpty) {
      params['categoryId'] = categoryId;
    }

    final uri = Uri.parse('$baseUrl/stylist/search').replace(queryParameters: params);

    try {
      final response = await http.get(uri);
      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        return data['data'];
      } else {
        throw Exception(data['message']);
      }
    } catch (e) {
      throw Exception('Search failed: $e');
    }
  }
}

// Usage
final searchService = StylistSearchService('http://localhost:5000');
final results = await searchService.searchStylists(
  query: 'hair stylist',
  city: 'Mumbai',
  minRating: 4.0,
  maxPrice: 5000,
  page: 1,
  limit: 10,
);
```

---

## Important Notes

### 1. Approved Stylists Only
- Only approved and available stylists are returned
- Stylists must have:
  - `isApproved: true`
  - `approvalStatus: 'approved'`
  - `applicationStatus: 'approved'`
  - `bookingSettings.isAvailableForBooking: true`

### 2. Case-Insensitive Search
- Text search is case-insensitive
- Location filters are case-insensitive
- Category name search is case-insensitive

### 3. Search Behavior
- If no search query (`q`) is provided, all approved stylists matching filters are returned
- Search query searches across multiple fields simultaneously (OR logic)
- Multiple filters are combined with AND logic

### 4. Pagination Limits
- Default page size: 10
- Recommended maximum: 50 results per page
- Large page sizes may impact performance

### 5. Category Filter
- Can use either `category` (name) or `categoryId` (ID)
- If both are provided, `categoryId` takes precedence
- Category search is case-insensitive when using name

### 6. Rating Filter
- Minimum rating: 0 (no minimum)
- Maximum rating: 5
- Stylists with rating >= `minRating` are returned

### 7. Price Filter
- Only maximum price filter is supported
- Stylists with price <= `maxPrice` are returned
- Price is in the base currency (typically INR)

---

## Comparison with Other Endpoints

### `/stylist/search` vs `/stylist/approved`

| Feature | `/stylist/search` | `/stylist/approved` |
|---------|-------------------|---------------------|
| Text Search | ✅ Full-text search | ❌ No text search |
| Filters | ✅ All filters | ✅ All filters |
| Use Case | User search/explore | Browse/filter |

**Recommendation**: Use `/stylist/search` when users are actively searching with text queries. Use `/stylist/approved` for browsing with filters only.

### `/stylist/search` vs `/stylist/top`

| Feature | `/stylist/search` | `/stylist/top` |
|---------|-------------------|----------------|
| Text Search | ✅ Full-text search | ❌ No text search |
| Ranking | ✅ Custom sorting | ✅ Algorithm-based ranking |
| Use Case | User search/explore | Featured/top stylists |

**Recommendation**: Use `/stylist/search` for user-initiated searches. Use `/stylist/top` to show featured/recommended stylists.

---

## Best Practices

1. **Search Query Length**
   - Keep search queries concise (2-5 words)
   - Avoid very long queries for better performance

2. **Pagination**
   - Use reasonable page sizes (10-20 for mobile, 20-50 for web)
   - Implement infinite scroll or "Load More" for better UX

3. **Filter Combinations**
   - Start with search query, then add filters
   - Too many filters may return zero results

4. **Error Handling**
   - Always handle errors gracefully
   - Show user-friendly error messages
   - Implement retry logic for network errors

5. **Performance**
   - Cache frequent searches on client-side
   - Debounce search input (wait 300-500ms after user stops typing)
   - Use pagination to limit initial load

---

## Troubleshooting

### No Results Returned

**Possible causes:**
- Search query doesn't match any stylist fields
- Filters are too restrictive
- All matching stylists are on other pages

**Solutions:**
- Try broader search terms
- Remove some filters
- Check pagination (try page 1)

### Slow Response Times

**Possible causes:**
- Large result set
- Complex query with many filters
- Database performance

**Solutions:**
- Use pagination with smaller page sizes
- Add more specific filters to reduce result set
- Consider implementing search indexing

---

## Summary

The `/stylist/search` endpoint provides:
- ✅ Full-text search across multiple fields
- ✅ Flexible filtering options
- ✅ Multiple sorting options
- ✅ Pagination support
- ✅ Returns only approved stylists
- ✅ Public access (no authentication required)

Perfect for implementing search functionality in your application!
