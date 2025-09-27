# Instagram Integration Service Architecture

## Service Overview

The Instagram Integration Service manages content synchronization from Instagram Business accounts, providing cached content for the website's gallery and CMS integration. It handles API rate limiting, content moderation, and automatic refresh with webhook support.

## Architecture Components

### 1. Instagram Service Core (FastAPI)
```
instagram-service/
├── app/
│   ├── core/
│   │   ├── config.py          # Configuration management
│   │   ├── database.py        # Database connections
│   │   ├── security.py        # Authentication/authorization
│   │   └── logging.py         # Structured logging
│   ├── models/
│   │   ├── instagram_post.py  # Instagram post model (existing)
│   │   ├── instagram_account.py # Account management
│   │   ├── sync_job.py        # Synchronization tracking
│   │   └── content_filter.py  # Content moderation
│   ├── services/
│   │   ├── instagram_api.py   # Instagram Basic Display API client
│   │   ├── content_sync.py    # Content synchronization logic
│   │   ├── image_processor.py # Image processing and optimization
│   │   ├── webhook_handler.py # Real-time update handling
│   │   └── cache_manager.py   # Content caching strategy
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── posts.py       # Post management endpoints
│   │   │   │   ├── sync.py        # Sync control endpoints
│   │   │   │   ├── gallery.py     # Gallery integration
│   │   │   │   └── webhooks.py    # Instagram webhooks
│   │   │   └── router.py
│   │   └── dependencies.py
│   ├── workers/
│   │   ├── sync_worker.py     # Background sync processing
│   │   ├── image_worker.py    # Image processing worker
│   │   └── scheduler.py       # Periodic sync scheduler
│   └── utils/
│       ├── image_utils.py     # Image manipulation utilities
│       ├── rate_limiter.py    # API rate limiting
│       └── content_validator.py # Content validation
├── storage/
│   ├── images/
│   │   ├── original/          # Original images from Instagram
│   │   ├── thumbnails/        # Generated thumbnails
│   │   └── optimized/         # Optimized for web
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
└── deployment/
    ├── kubernetes/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── configmap.yaml
    │   ├── secrets.yaml
    │   └── persistent-volume.yaml
    └── monitoring/
        ├── prometheus.yml
        └── grafana-dashboard.json
```

### 2. Database Schema Extensions

#### Enhanced Existing Model
```python
# Enhanced InstagramPost model
class InstagramPost(Base, UUIDMixin):
    __tablename__ = "instagram_posts"

    # Core Instagram data
    instagram_id: str = Column(String(100), unique=True, nullable=False)
    post_type: str = Column(String(20), nullable=False)  # image, video, carousel_album
    caption: Optional[str] = Column(Text, nullable=True)
    media_url: str = Column(Text, nullable=False)
    thumbnail_url: Optional[str] = Column(Text, nullable=True)
    permalink: str = Column(Text, nullable=False)

    # Enhanced metadata
    media_product_type: str = Column(String(50), nullable=True)  # FEED, REELS, IGTV
    media_type: str = Column(String(20), nullable=False)  # IMAGE, VIDEO
    shortcode: str = Column(String(50), nullable=True)  # Instagram shortcode

    # Engagement metrics
    likes_count: int = Column(Integer, default=0, nullable=False)
    comments_count: int = Column(Integer, default=0, nullable=False)

    # Content analysis
    hashtags: List[str] = Column(ARRAY(String), nullable=True)
    mentions: List[str] = Column(ARRAY(String), nullable=True)
    content_tags: List[str] = Column(ARRAY(String), nullable=True)  # AI-generated tags

    # Display and CMS integration
    is_featured: bool = Column(Boolean, default=False, nullable=False)
    is_approved: bool = Column(Boolean, default=True, nullable=False)  # Content moderation
    display_order: int = Column(Integer, default=0, nullable=False)
    gallery_category: str = Column(String(50), nullable=True)  # before_after, portfolio, etc.

    # Local file paths
    local_image_path: Optional[str] = Column(String(500), nullable=True)
    local_thumbnail_path: Optional[str] = Column(String(500), nullable=True)
    local_optimized_path: Optional[str] = Column(String(500), nullable=True)

    # Sync metadata
    posted_at: datetime = Column(DateTime(timezone=True), nullable=False)
    synced_at: datetime = Column(DateTime(timezone=True), nullable=False)
    last_updated_at: datetime = Column(DateTime(timezone=True), nullable=False)
    sync_error: Optional[str] = Column(Text, nullable=True)
    sync_retry_count: int = Column(Integer, default=0, nullable=False)
```

#### New Models
```python
class InstagramAccount(Base, UUIDMixin):
    """Instagram business account configuration"""
    __tablename__ = "instagram_accounts"

    business_account_id: str = Column(String(100), unique=True, nullable=False)
    username: str = Column(String(100), nullable=False)
    name: str = Column(String(200), nullable=True)
    biography: str = Column(Text, nullable=True)
    profile_picture_url: str = Column(Text, nullable=True)
    followers_count: int = Column(Integer, default=0, nullable=False)
    follows_count: int = Column(Integer, default=0, nullable=False)
    media_count: int = Column(Integer, default=0, nullable=False)

    # API configuration
    access_token: str = Column(Text, nullable=False)  # Encrypted
    token_expires_at: datetime = Column(DateTime(timezone=True), nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False)

    # Sync settings
    auto_sync_enabled: bool = Column(Boolean, default=True, nullable=False)
    sync_frequency_minutes: int = Column(Integer, default=60, nullable=False)
    max_posts_to_sync: int = Column(Integer, default=50, nullable=False)

    # Last sync info
    last_sync_at: datetime = Column(DateTime(timezone=True), nullable=True)
    last_sync_cursor: str = Column(String(200), nullable=True)
    last_sync_error: str = Column(Text, nullable=True)

class SyncJob(Base, UUIDMixin):
    """Track synchronization jobs"""
    __tablename__ = "sync_jobs"

    account_id: str = Column(UUID(as_uuid=False), ForeignKey("instagram_accounts.id"))
    sync_type: SyncType = Column(Enum(SyncType), nullable=False)  # FULL, INCREMENTAL, MANUAL
    status: SyncStatus = Column(Enum(SyncStatus), default=SyncStatus.PENDING)

    started_at: datetime = Column(DateTime(timezone=True), nullable=False)
    completed_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)

    posts_processed: int = Column(Integer, default=0, nullable=False)
    posts_added: int = Column(Integer, default=0, nullable=False)
    posts_updated: int = Column(Integer, default=0, nullable=False)
    posts_failed: int = Column(Integer, default=0, nullable=False)

    error_message: Optional[str] = Column(Text, nullable=True)
    api_calls_made: int = Column(Integer, default=0, nullable=False)
    rate_limit_hit: bool = Column(Boolean, default=False, nullable=False)

class ContentFilter(Base, UUIDMixin):
    """Content filtering and moderation rules"""
    __tablename__ = "content_filters"

    name: str = Column(String(100), nullable=False)
    description: str = Column(Text, nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False)

    # Filter criteria
    hashtag_blacklist: List[str] = Column(ARRAY(String), nullable=True)
    hashtag_whitelist: List[str] = Column(ARRAY(String), nullable=True)
    content_keywords: List[str] = Column(ARRAY(String), nullable=True)
    min_likes: int = Column(Integer, default=0, nullable=False)
    min_engagement_rate: float = Column(Float, default=0.0, nullable=False)

    # Actions
    auto_approve: bool = Column(Boolean, default=False, nullable=False)
    auto_feature: bool = Column(Boolean, default=False, nullable=False)
    auto_categorize: str = Column(String(50), nullable=True)
```

### 3. Instagram API Integration

#### Instagram Basic Display API Client
```python
class InstagramAPIClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.base_url = "https://graph.instagram.com"
        self.rate_limiter = InstagramRateLimiter()

    async def get_user_media(self, user_id: str, limit: int = 25, after: str = None) -> Dict:
        """Get user's media with pagination"""
        await self.rate_limiter.wait_if_needed()

        params = {
            'fields': 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count',
            'limit': limit,
            'access_token': self.access_token
        }

        if after:
            params['after'] = after

        url = f"{self.base_url}/{user_id}/media"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                self.rate_limiter.update_rate_limit(response.headers)

                if response.status == 200:
                    return await response.json()
                elif response.status == 429:
                    # Rate limit exceeded
                    retry_after = int(response.headers.get('retry-after', 3600))
                    raise RateLimitExceeded(retry_after)
                else:
                    raise InstagramAPIError(f"API call failed: {response.status}")

    async def get_media_details(self, media_id: str) -> Dict:
        """Get detailed information about a specific media"""
        await self.rate_limiter.wait_if_needed()

        params = {
            'fields': 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count,media_product_type',
            'access_token': self.access_token
        }

        url = f"{self.base_url}/{media_id}"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    raise InstagramAPIError(f"Failed to get media details: {response.status}")

    async def refresh_access_token(self, current_token: str) -> Dict:
        """Refresh long-lived access token"""
        params = {
            'grant_type': 'ig_refresh_token',
            'access_token': current_token
        }

        url = f"{self.base_url}/refresh_access_token"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    raise InstagramAPIError("Failed to refresh access token")
```

#### Rate Limiting Strategy
```python
class InstagramRateLimiter:
    def __init__(self):
        self.redis_client = Redis()
        self.rate_limit_key = "instagram_api_rate_limit"

        # Instagram API limits: 200 calls per hour per app
        self.max_calls_per_hour = 200
        self.time_window = 3600  # 1 hour in seconds

    async def wait_if_needed(self):
        """Wait if rate limit would be exceeded"""
        current_count = await self.get_current_count()

        if current_count >= self.max_calls_per_hour:
            wait_time = await self.get_reset_time()
            logger.warning(f"Rate limit reached, waiting {wait_time} seconds")
            await asyncio.sleep(wait_time)

    async def increment_count(self):
        """Increment API call count"""
        pipe = self.redis_client.pipeline()
        pipe.incr(self.rate_limit_key)
        pipe.expire(self.rate_limit_key, self.time_window)
        await pipe.execute()

    async def get_current_count(self) -> int:
        """Get current API call count"""
        count = await self.redis_client.get(self.rate_limit_key)
        return int(count) if count else 0

    def update_rate_limit(self, response_headers: dict):
        """Update rate limit info from response headers"""
        # Instagram provides x-app-usage header with usage info
        app_usage = response_headers.get('x-app-usage')
        if app_usage:
            usage_data = json.loads(app_usage)
            current_usage = usage_data.get('call_count', 0)

            # Update Redis with actual usage
            self.redis_client.set(
                self.rate_limit_key,
                current_usage,
                ex=self.time_window
            )
```

### 4. Content Synchronization Service

#### Sync Strategy
```python
class ContentSyncService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.api_client = InstagramAPIClient()
        self.image_processor = ImageProcessor()
        self.content_filter = ContentFilterService()

    async def sync_account_content(self, account_id: str, sync_type: SyncType = SyncType.INCREMENTAL):
        """Synchronize content for an Instagram account"""

        # Create sync job
        sync_job = SyncJob(
            account_id=account_id,
            sync_type=sync_type,
            status=SyncStatus.RUNNING,
            started_at=datetime.utcnow()
        )
        self.db.add(sync_job)
        await self.db.commit()

        try:
            account = await self.get_account(account_id)

            # Get posts from Instagram API
            if sync_type == SyncType.FULL:
                posts_data = await self.fetch_all_posts(account)
            else:
                posts_data = await self.fetch_new_posts(account)

            # Process each post
            for post_data in posts_data:
                try:
                    await self.process_post(post_data, account, sync_job)
                    sync_job.posts_processed += 1
                except Exception as e:
                    logger.error(f"Failed to process post {post_data['id']}: {e}")
                    sync_job.posts_failed += 1

            # Update sync job status
            sync_job.status = SyncStatus.COMPLETED
            sync_job.completed_at = datetime.utcnow()

        except Exception as e:
            sync_job.status = SyncStatus.FAILED
            sync_job.error_message = str(e)
            sync_job.completed_at = datetime.utcnow()

        finally:
            await self.db.commit()

    async def process_post(self, post_data: dict, account: InstagramAccount, sync_job: SyncJob):
        """Process individual Instagram post"""

        # Check if post already exists
        existing_post = await self.get_post_by_instagram_id(post_data['id'])

        if existing_post:
            # Update existing post
            await self.update_post(existing_post, post_data)
            sync_job.posts_updated += 1
        else:
            # Create new post
            await self.create_post(post_data, account)
            sync_job.posts_added += 1

    async def create_post(self, post_data: dict, account: InstagramAccount):
        """Create new Instagram post record"""

        # Extract hashtags and mentions from caption
        hashtags, mentions = self.extract_social_tags(post_data.get('caption', ''))

        # Apply content filters
        is_approved = await self.content_filter.should_approve(post_data, hashtags)
        is_featured = await self.content_filter.should_feature(post_data, hashtags)
        category = await self.content_filter.categorize(post_data, hashtags)

        # Download and process images
        local_paths = await self.image_processor.process_media(
            post_data['media_url'],
            post_data.get('thumbnail_url'),
            post_data['id']
        )

        # Create post record
        post = InstagramPost(
            instagram_id=post_data['id'],
            post_type=post_data['media_type'].lower(),
            caption=post_data.get('caption'),
            media_url=post_data['media_url'],
            thumbnail_url=post_data.get('thumbnail_url'),
            permalink=post_data['permalink'],
            media_product_type=post_data.get('media_product_type'),
            likes_count=post_data.get('like_count', 0),
            comments_count=post_data.get('comments_count', 0),
            hashtags=hashtags,
            mentions=mentions,
            is_approved=is_approved,
            is_featured=is_featured,
            gallery_category=category,
            local_image_path=local_paths.get('original'),
            local_thumbnail_path=local_paths.get('thumbnail'),
            local_optimized_path=local_paths.get('optimized'),
            posted_at=datetime.fromisoformat(post_data['timestamp'].replace('Z', '+00:00')),
            synced_at=datetime.utcnow(),
            last_updated_at=datetime.utcnow()
        )

        self.db.add(post)
        await self.db.commit()
```

### 5. Image Processing Service

#### Multi-Format Image Processing
```python
class ImageProcessor:
    def __init__(self):
        self.storage_path = Path("storage/images")
        self.storage_path.mkdir(parents=True, exist_ok=True)

        # Image optimization settings
        self.thumbnail_size = (300, 300)
        self.optimized_size = (800, 800)
        self.quality = 85

    async def process_media(self, media_url: str, thumbnail_url: str, instagram_id: str) -> dict:
        """Download and process Instagram media"""

        paths = {
            'original': None,
            'thumbnail': None,
            'optimized': None
        }

        try:
            # Download original image
            original_path = await self.download_image(media_url, instagram_id, 'original')
            paths['original'] = str(original_path)

            # Generate thumbnail
            thumbnail_path = await self.generate_thumbnail(original_path, instagram_id)
            paths['thumbnail'] = str(thumbnail_path)

            # Generate optimized version
            optimized_path = await self.generate_optimized(original_path, instagram_id)
            paths['optimized'] = str(optimized_path)

            return paths

        except Exception as e:
            logger.error(f"Failed to process media for {instagram_id}: {e}")
            raise

    async def download_image(self, url: str, instagram_id: str, variant: str) -> Path:
        """Download image from Instagram"""

        file_extension = self.get_file_extension(url)
        filename = f"{instagram_id}_{variant}{file_extension}"
        file_path = self.storage_path / variant / filename

        file_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    with open(file_path, 'wb') as f:
                        async for chunk in response.content.iter_chunked(8192):
                            f.write(chunk)
                    return file_path
                else:
                    raise ImageDownloadError(f"Failed to download image: {response.status}")

    async def generate_thumbnail(self, original_path: Path, instagram_id: str) -> Path:
        """Generate thumbnail from original image"""

        thumbnail_path = self.storage_path / "thumbnails" / f"{instagram_id}_thumb.webp"
        thumbnail_path.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(original_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')

            # Generate thumbnail maintaining aspect ratio
            img.thumbnail(self.thumbnail_size, Image.Resampling.LANCZOS)

            # Save as WebP for better compression
            img.save(thumbnail_path, 'WEBP', quality=self.quality, optimize=True)

        return thumbnail_path

    async def generate_optimized(self, original_path: Path, instagram_id: str) -> Path:
        """Generate optimized version for web display"""

        optimized_path = self.storage_path / "optimized" / f"{instagram_id}_opt.webp"
        optimized_path.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(original_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')

            # Resize if larger than target
            if img.size[0] > self.optimized_size[0] or img.size[1] > self.optimized_size[1]:
                img.thumbnail(self.optimized_size, Image.Resampling.LANCZOS)

            # Save as WebP
            img.save(optimized_path, 'WEBP', quality=self.quality, optimize=True)

        return optimized_path

    def get_file_extension(self, url: str) -> str:
        """Extract file extension from URL"""
        parsed = urlparse(url)
        path = parsed.path
        return Path(path).suffix or '.jpg'
```

### 6. Content Filtering and Moderation

#### AI-Powered Content Analysis
```python
class ContentFilterService:
    def __init__(self):
        self.db = AsyncSession()
        self.inappropriate_keywords = self.load_inappropriate_keywords()

    async def should_approve(self, post_data: dict, hashtags: List[str]) -> bool:
        """Determine if post should be auto-approved"""

        # Get active filters
        filters = await self.get_active_filters()

        for filter_rule in filters:
            # Check hashtag blacklist
            if filter_rule.hashtag_blacklist:
                if any(tag in hashtags for tag in filter_rule.hashtag_blacklist):
                    return False

            # Check content keywords
            caption = post_data.get('caption', '').lower()
            if filter_rule.content_keywords:
                if any(keyword in caption for keyword in filter_rule.content_keywords):
                    return False

            # Check engagement thresholds
            likes = post_data.get('like_count', 0)
            if likes < filter_rule.min_likes:
                return False

        # Check for inappropriate content
        if await self.contains_inappropriate_content(post_data):
            return False

        return True

    async def should_feature(self, post_data: dict, hashtags: List[str]) -> bool:
        """Determine if post should be featured"""

        # High engagement posts
        likes = post_data.get('like_count', 0)
        comments = post_data.get('comments_count', 0)
        engagement = likes + (comments * 3)  # Weight comments more

        if engagement > 100:  # Configurable threshold
            return True

        # Posts with specific hashtags
        featured_hashtags = ['#portfolio', '#beforeafter', '#transformation']
        if any(tag in hashtags for tag in featured_hashtags):
            return True

        return False

    async def categorize(self, post_data: dict, hashtags: List[str]) -> str:
        """Automatically categorize post based on content"""

        caption = post_data.get('caption', '').lower()

        # Category mapping based on hashtags and content
        category_keywords = {
            'before_after': ['#beforeafter', '#transformation', 'before', 'after'],
            'portfolio': ['#portfolio', '#work', '#client'],
            'tutorial': ['#tutorial', '#howto', '#diy'],
            'product': ['#product', '#review', 'product'],
            'personal': ['#personal', '#me', '#selfie']
        }

        for category, keywords in category_keywords.items():
            if any(keyword in caption or keyword in hashtags for keyword in keywords):
                return category

        return 'general'

    async def contains_inappropriate_content(self, post_data: dict) -> bool:
        """Check for inappropriate content using AI/ML"""

        caption = post_data.get('caption', '').lower()

        # Simple keyword-based filtering (can be enhanced with ML)
        for keyword in self.inappropriate_keywords:
            if keyword in caption:
                return True

        # TODO: Implement image analysis for inappropriate visual content
        # This could use services like Google Vision API or AWS Rekognition

        return False

    def extract_social_tags(self, caption: str) -> Tuple[List[str], List[str]]:
        """Extract hashtags and mentions from caption"""

        if not caption:
            return [], []

        # Extract hashtags
        hashtag_pattern = r'#\w+'
        hashtags = re.findall(hashtag_pattern, caption.lower())

        # Extract mentions
        mention_pattern = r'@\w+'
        mentions = re.findall(mention_pattern, caption.lower())

        return hashtags, mentions
```

### 7. Webhook Integration

#### Real-time Content Updates
```python
class InstagramWebhookHandler:
    def __init__(self):
        self.verify_token = settings.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
        self.content_sync = ContentSyncService()

    async def handle_webhook(self, request: Request):
        """Handle Instagram webhook notifications"""

        # Verify webhook signature
        if not await self.verify_webhook_signature(request):
            raise HTTPException(status_code=401, detail="Invalid signature")

        payload = await request.json()

        # Process each entry in the webhook
        for entry in payload.get('entry', []):
            await self.process_webhook_entry(entry)

    async def process_webhook_entry(self, entry: dict):
        """Process individual webhook entry"""

        user_id = entry.get('id')
        changes = entry.get('changes', [])

        for change in changes:
            field = change.get('field')
            value = change.get('value')

            if field == 'media':
                await self.handle_media_change(user_id, value)

    async def handle_media_change(self, user_id: str, change_data: dict):
        """Handle media creation/update/deletion"""

        media_id = change_data.get('media_id')

        if change_data.get('verb') == 'create':
            # New media posted
            await self.sync_new_media(user_id, media_id)
        elif change_data.get('verb') == 'update':
            # Media updated (likes, comments)
            await self.update_media_metrics(media_id)
        elif change_data.get('verb') == 'delete':
            # Media deleted
            await self.mark_media_deleted(media_id)

    async def sync_new_media(self, user_id: str, media_id: str):
        """Sync newly posted media"""

        try:
            # Get account configuration
            account = await self.get_account_by_user_id(user_id)
            if not account or not account.auto_sync_enabled:
                return

            # Fetch media details from API
            api_client = InstagramAPIClient(account.access_token)
            media_data = await api_client.get_media_details(media_id)

            # Process the new media
            await self.content_sync.process_post(media_data, account, None)

        except Exception as e:
            logger.error(f"Failed to sync new media {media_id}: {e}")

    async def verify_webhook_signature(self, request: Request) -> bool:
        """Verify Instagram webhook signature"""

        signature = request.headers.get('x-hub-signature-256')
        if not signature:
            return False

        # Remove 'sha256=' prefix
        signature = signature.replace('sha256=', '')

        # Calculate expected signature
        body = await request.body()
        expected_signature = hmac.new(
            self.verify_token.encode(),
            body,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_signature)
```

### 8. API Endpoints

#### Post Management API
```python
@router.get("/posts", response_model=List[InstagramPostResponse])
async def list_posts(
    category: Optional[str] = None,
    featured_only: bool = False,
    approved_only: bool = True,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """List Instagram posts with filtering"""

    query = select(InstagramPost)

    if category:
        query = query.where(InstagramPost.gallery_category == category)
    if featured_only:
        query = query.where(InstagramPost.is_featured == True)
    if approved_only:
        query = query.where(InstagramPost.is_approved == True)

    query = query.order_by(InstagramPost.posted_at.desc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    posts = result.scalars().all()

    return posts

@router.get("/posts/{post_id}", response_model=InstagramPostResponse)
async def get_post(
    post_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get specific Instagram post"""

    query = select(InstagramPost).where(InstagramPost.id == post_id)
    result = await db.execute(query)
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    return post

@router.patch("/posts/{post_id}", response_model=InstagramPostResponse)
async def update_post(
    post_id: str,
    post_update: InstagramPostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update Instagram post (admin only)"""

    query = select(InstagramPost).where(InstagramPost.id == post_id)
    result = await db.execute(query)
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Update allowed fields
    for field, value in post_update.dict(exclude_unset=True).items():
        setattr(post, field, value)

    post.last_updated_at = datetime.utcnow()
    await db.commit()

    return post
```

#### Sync Control API
```python
@router.post("/sync/trigger", response_model=SyncJobResponse)
async def trigger_sync(
    sync_request: SyncTriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Manually trigger content synchronization"""

    # Create sync job
    sync_job = SyncJob(
        account_id=sync_request.account_id,
        sync_type=sync_request.sync_type,
        status=SyncStatus.PENDING,
        started_at=datetime.utcnow()
    )

    db.add(sync_job)
    await db.commit()

    # Queue background task
    sync_worker.sync_account_content.delay(
        sync_job.id,
        sync_request.account_id,
        sync_request.sync_type
    )

    return sync_job

@router.get("/sync/status", response_model=List[SyncJobResponse])
async def get_sync_status(
    account_id: Optional[str] = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """Get synchronization job status"""

    query = select(SyncJob).order_by(SyncJob.started_at.desc())

    if account_id:
        query = query.where(SyncJob.account_id == account_id)

    query = query.limit(limit)

    result = await db.execute(query)
    jobs = result.scalars().all()

    return jobs
```

### 9. Integration with CMS

#### Gallery Integration
```python
class GalleryIntegrationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_gallery_content(self, category: str = None, limit: int = 12) -> List[dict]:
        """Get Instagram content for website gallery"""

        query = select(InstagramPost).where(
            InstagramPost.is_approved == True,
            InstagramPost.local_optimized_path.is_not(None)
        )

        if category:
            query = query.where(InstagramPost.gallery_category == category)

        # Prioritize featured posts
        query = query.order_by(
            InstagramPost.is_featured.desc(),
            InstagramPost.posted_at.desc()
        ).limit(limit)

        result = await self.db.execute(query)
        posts = result.scalars().all()

        # Transform for frontend consumption
        gallery_items = []
        for post in posts:
            gallery_items.append({
                'id': post.id,
                'image_url': f"/api/instagram/images/{post.id}/optimized",
                'thumbnail_url': f"/api/instagram/images/{post.id}/thumbnail",
                'caption': post.caption,
                'instagram_url': post.permalink,
                'likes_count': post.likes_count,
                'comments_count': post.comments_count,
                'posted_at': post.posted_at.isoformat(),
                'category': post.gallery_category,
                'is_featured': post.is_featured
            })

        return gallery_items

    async def get_featured_posts(self, limit: int = 6) -> List[dict]:
        """Get featured posts for homepage"""

        query = select(InstagramPost).where(
            InstagramPost.is_featured == True,
            InstagramPost.is_approved == True
        ).order_by(InstagramPost.posted_at.desc()).limit(limit)

        result = await self.db.execute(query)
        posts = result.scalars().all()

        return [self.transform_post_for_display(post) for post in posts]
```

This Instagram integration service architecture provides comprehensive content synchronization, intelligent filtering, and seamless CMS integration while respecting API rate limits and providing robust error handling. The service is designed to scale with your business needs and integrate smoothly with your existing FastAPI backend.