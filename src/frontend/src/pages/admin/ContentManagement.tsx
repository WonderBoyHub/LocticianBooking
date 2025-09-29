import React from 'react';
import { motion } from 'framer-motion';
import {
  Images,
  AlertTriangle,
  ExternalLink,
  Heart,
  MessageCircle,
  CalendarDays,
  UploadCloud,
  Trash2,
  Play
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import {
  useGetInstagramPostsAdminQuery,
  useUpdateInstagramPostMutation,
  useGetMediaLibraryQuery,
  useUploadMediaAssetMutation,
  useUpdateMediaAssetMutation,
  useDeleteMediaAssetMutation
} from '../../store/api';
import { useAppDispatch } from '../../store/hooks';
import { addNotification } from '../../store/slices/uiSlice';
import type { InstagramPost, MediaAssetAdmin } from '../../types';
import { mapInstagramPostDto } from '../../utils/instagram';

const MAX_FEATURED_POSTS = 9;

export const ContentManagement: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    data,
    isLoading,
    isError,
    refetch
  } = useGetInstagramPostsAdminQuery();
  const [updatePost, { isLoading: isUpdating }] = useUpdateInstagramPostMutation();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const {
    data: mediaData,
    isLoading: mediaLoading,
    isError: mediaError,
    refetch: refetchMedia
  } = useGetMediaLibraryQuery();
  const [uploadMedia, { isLoading: isUploading }] = useUploadMediaAssetMutation();
  const [updateMediaAsset, { isLoading: isUpdatingMedia }] = useUpdateMediaAssetMutation();
  const [deleteMediaAsset, { isLoading: isDeletingMedia }] = useDeleteMediaAssetMutation();
  const [activeMediaId, setActiveMediaId] = React.useState<string | null>(null);

  const posts = React.useMemo<InstagramPost[]>(() => {
    if (!data?.data) {
      return [];
    }

    return data.data.map(mapInstagramPostDto);
  }, [data]);

  const mediaLibrary = React.useMemo<MediaAssetAdmin[]>(() => mediaData ?? [], [mediaData]);

  const [orders, setOrders] = React.useState<Record<string, number>>({});

  const [mediaForm, setMediaForm] = React.useState<{
    file: File | null;
    altText: string;
    caption: string;
    isFeatured: boolean;
  }>({
    file: null,
    altText: '',
    caption: '',
    isFeatured: false
  });

  React.useEffect(() => {
    const nextOrders = posts.reduce<Record<string, number>>((acc, post) => {
      acc[post.id] = post.displayOrder ?? 0;
      return acc;
    }, {});
    setOrders(nextOrders);
  }, [posts]);

  const featuredCount = React.useMemo(
    () => posts.filter((post) => post.isFeatured).length,
    [posts]
  );

  const handleMediaFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mediaForm.file) {
      dispatch(
        addNotification({
          type: 'error',
          message: 'Vælg en fil før du uploader.'
        })
      );
      return;
    }

    try {
      await uploadMedia({
        file: mediaForm.file,
        altText: mediaForm.altText || undefined,
        caption: mediaForm.caption || undefined,
        isFeatured: mediaForm.isFeatured,
      }).unwrap();

      dispatch(
        addNotification({
          type: 'success',
          message: 'Mediefilen er uploadet.'
        })
      );

      setMediaForm({ file: null, altText: '', caption: '', isFeatured: false });
      await refetchMedia();
    } catch (error) {
      console.error(error);
      dispatch(
        addNotification({
          type: 'error',
          message: 'Kunne ikke uploade mediefilen. Prøv igen.'
        })
      );
    }
  };

  const handleMediaFeatureToggle = async (media: MediaAssetAdmin, value: boolean) => {
    setActiveMediaId(media.id);
    try {
      await updateMediaAsset({
        id: media.id,
        data: { isFeatured: value }
      }).unwrap();
      dispatch(
        addNotification({
          type: 'success',
          message: value
            ? 'Mediet er nu fremhævet på forsiden.'
            : 'Mediet er fjernet fra forsiden.'
        })
      );
      await refetchMedia();
    } catch (error) {
      console.error(error);
      dispatch(
        addNotification({
          type: 'error',
          message: 'Kunne ikke opdatere media. Prøv igen.'
        })
      );
    } finally {
      setActiveMediaId(null);
    }
  };

  const handleMediaDelete = async (mediaId: string) => {
    setActiveMediaId(mediaId);
    try {
      await deleteMediaAsset(mediaId).unwrap();
      dispatch(
        addNotification({
          type: 'success',
          message: 'Mediefilen er slettet.'
        })
      );
      await refetchMedia();
    } catch (error) {
      console.error(error);
      dispatch(
        addNotification({
          type: 'error',
          message: 'Kunne ikke slette mediefilen. Prøv igen.'
        })
      );
    } finally {
      setActiveMediaId(null);
    }
  };

  const handleToggleFeatured = async (post: InstagramPost) => {
    setPendingId(post.id);
    try {
      await updatePost({
        id: post.id,
        data: { isFeatured: !post.isFeatured }
      }).unwrap();
      dispatch(
        addNotification({
          type: 'success',
          message: post.isFeatured
            ? 'Opslaget er fjernet fra forsiden.'
            : 'Opslaget er nu fremhævet på forsiden.'
        })
      );
      await refetch();
    } catch (error) {
      console.error(error);
      dispatch(
        addNotification({
          type: 'error',
          message: 'Kunne ikke opdatere opslaget. Prøv igen.'
        })
      );
    } finally {
      setPendingId(null);
    }
  };

  const handleOrderChange = (postId: string, value: string) => {
    const parsed = Number(value);
    setOrders((prev) => ({
      ...prev,
      [postId]: Number.isNaN(parsed) ? 0 : parsed
    }));
  };

  const handleSaveOrder = async (post: InstagramPost) => {
    setPendingId(post.id);
    try {
      await updatePost({
        id: post.id,
        data: { displayOrder: orders[post.id] ?? 0 }
      }).unwrap();
      dispatch(
        addNotification({
          type: 'success',
          message: 'Visningsrækkefølgen er opdateret.'
        })
      );
      await refetch();
    } catch (error) {
      console.error(error);
      dispatch(
        addNotification({
          type: 'error',
          message: 'Kunne ikke opdatere visningsrækkefølgen. Prøv igen.'
        })
      );
    } finally {
      setPendingId(null);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl bg-white p-6 shadow-soft border border-brown-100 animate-pulse h-80"
            />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="rounded-2xl border border-dashed border-brand-primary/40 bg-brand-accent/60 p-8 text-brand-dark">
          <p className="font-medium mb-4">
            Der opstod en fejl under indlæsning af Instagram-opslagene.
          </p>
          <Button variant="primary" onClick={() => refetch()}>
            Prøv igen
          </Button>
        </div>
      );
    }

    if (!posts.length) {
      return (
        <div className="rounded-2xl border border-dashed border-brand-primary/40 bg-brand-accent/60 p-8 text-brand-dark">
          <p className="font-medium">
            Der er endnu ikke synkroniseret nogen Instagram-opslag. Synkronisér og marker derefter de opslag, der skal vises på forsiden.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {posts.map((post) => {
          const displayOrder = orders[post.id] ?? post.displayOrder ?? 0;
          const isPending = pendingId === post.id && isUpdating;
          const orderChanged = displayOrder !== (post.displayOrder ?? 0);

          return (
            <motion.div
              key={post.id}
              whileHover={{ y: -4, boxShadow: '0 18px 30px -15px rgba(107,78,50,0.3)' }}
              className="bg-white rounded-2xl overflow-hidden shadow-soft border border-brown-100 flex flex-col"
            >
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block aspect-square overflow-hidden"
              >
                <img
                  src={post.thumbnailUrl ?? post.mediaUrl}
                  alt={post.caption ? post.caption.slice(0, 100) : 'Instagram opslag'}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                  <Images className="h-3.5 w-3.5" />
                  {post.postType}
                </span>
              </a>

              <div className="p-5 flex-1 flex flex-col gap-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-brand-dark text-base">
                      Opslag #{post.instagramId}
                    </h3>
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-primary hover:text-brand-dark flex items-center gap-1 text-sm"
                    >
                      Se opslag
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <p
                    className="mt-2 text-sm text-gray-600 overflow-hidden text-ellipsis"
                    style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}
                  >
                    {post.caption ?? 'Ingen beskrivelse tilgængelig.'}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {post.likesCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {post.commentsCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(post.postedAt).toLocaleDateString('da-DK', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant={post.isFeatured ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleFeatured(post)}
                    isLoading={isPending}
                  >
                    {post.isFeatured ? 'Fremhævet' : 'Fremhæv'}
                  </Button>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={displayOrder}
                      onChange={(event) => handleOrderChange(post.id, event.target.value)}
                      className="w-20 rounded-lg border border-brown-200 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSaveOrder(post)}
                      disabled={!orderChanged}
                      isLoading={isPending && orderChanged}
                    >
                      Gem
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-soft border border-brown-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Images className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-brand-dark">
                Instagram indhold på forsiden
              </h1>
              <p className="text-sm text-gray-600">
                Vælg hvilke opslag der vises under overskriften på forsiden. Fremhæv op til {MAX_FEATURED_POSTS} opslag for den bedste præsentation.
              </p>
            </div>
          </div>

          <div className="text-sm text-right text-gray-600">
            <p>
              Fremhævede opslag: <span className="font-semibold text-brand-dark">{featuredCount}</span> / {MAX_FEATURED_POSTS}
            </p>
            {featuredCount > MAX_FEATURED_POSTS && (
              <p className="mt-1 inline-flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Visningen viser kun de første {MAX_FEATURED_POSTS} opslag efter sortering.
              </p>
            )}
          </div>
        </div>
      </div>

      {renderContent()}

      <div className="bg-white rounded-2xl shadow-soft border border-brown-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-brand-dark">
                Upload galleriindhold
              </h2>
              <p className="text-sm text-gray-600">
                Tilføj billeder og videoer, der kan vises på forsiden sammen med Instagram-opslag.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleMediaFormSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-1 space-y-2">
            <label className="block text-sm font-medium text-brand-dark">
              Fil
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(event) =>
                setMediaForm((prev) => ({
                  ...prev,
                  file: event.target.files?.[0] ?? null
                }))
              }
              className="w-full rounded-lg border border-brown-200 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <p className="text-xs text-gray-500">
              Understøtter JPG, PNG, WEBP og MP4 (max 10 MB).
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-brand-dark">
              Alternativ tekst
            </label>
            <input
              type="text"
              value={mediaForm.altText}
              onChange={(event) =>
                setMediaForm((prev) => ({ ...prev, altText: event.target.value }))
              }
              placeholder="Beskriv mediefilen for skærmlæsere"
              className="w-full rounded-lg border border-brown-200 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="block text-sm font-medium text-brand-dark">
              Kort beskrivelse (valgfri)
            </label>
            <textarea
              value={mediaForm.caption}
              onChange={(event) =>
                setMediaForm((prev) => ({ ...prev, caption: event.target.value }))
              }
              rows={3}
              className="w-full rounded-lg border border-brown-200 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              placeholder="Vises under billedet eller videoen"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="media-featured"
              type="checkbox"
              checked={mediaForm.isFeatured}
              onChange={(event) =>
                setMediaForm((prev) => ({ ...prev, isFeatured: event.target.checked }))
              }
              className="h-4 w-4 rounded border-brown-200 text-brand-primary focus:ring-brand-primary"
            />
            <label htmlFor="media-featured" className="text-sm text-brand-dark">
              Fremhæv på forsiden straks efter upload
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" variant="primary" isLoading={isUploading}>
              Upload medie
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-brown-100 p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-serif font-semibold text-brand-dark">
              Uploadede medier
            </h2>
            <p className="text-sm text-gray-600">
              Administrer de filer, der vises i galleriet. Fremhæv op til 9 stykker for forsiden.
            </p>
          </div>
          <div className="text-sm text-gray-600">
            Fremhævede filer: {mediaLibrary.filter((item) => item.isFeatured).length} / 9
          </div>
        </div>

        {mediaLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-72 rounded-2xl bg-brand-accent/40 border border-dashed border-brand-primary/40 animate-pulse"
              />
            ))}
          </div>
        ) : mediaError ? (
          <div className="rounded-2xl border border-dashed border-brand-primary/40 bg-brand-accent/60 p-8 text-brand-dark">
            Der opstod en fejl under indlæsning af medierne. Prøv igen.
          </div>
        ) : mediaLibrary.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {mediaLibrary.map((media) => {
              const isPending = activeMediaId === media.id && (isUpdatingMedia || isDeletingMedia);

              return (
                <div
                  key={media.id}
                  className="bg-white rounded-2xl border border-brown-100 shadow-soft overflow-hidden flex flex-col"
                >
                  <div className="relative">
                    {media.mimeType.startsWith('video/') ? (
                      <div className="relative">
                        <video src={media.url} controls className="w-full h-56 object-cover" />
                        <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                          <Play className="h-3.5 w-3.5" /> Video
                        </div>
                      </div>
                    ) : (
                      <img
                        src={media.url}
                        alt={media.altText ?? media.originalFilename}
                        className="w-full h-56 object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <div>
                      <h3 className="text-sm font-semibold text-brand-dark">
                        {media.originalFilename}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(media.uploadedAt).toLocaleString('da-DK')}
                      </p>
                    </div>
                    {media.caption ? (
                      <p
                        className="text-sm text-gray-600"
                        style={{
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 3,
                          overflow: 'hidden'
                        }}
                      >
                        {media.caption}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-3">
                      <Button
                        variant={media.isFeatured ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => handleMediaFeatureToggle(media, !media.isFeatured)}
                        isLoading={isPending && isUpdatingMedia}
                      >
                        {media.isFeatured ? 'Fremhævet' : 'Fremhæv'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMediaDelete(media.id)}
                        isLoading={isPending && isDeletingMedia}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-brand-primary/40 bg-brand-accent/60 p-8 text-brand-dark">
            Der er endnu ikke uploadet nogen medier. Upload billeder eller videoer for at udfylde galleriet.
          </div>
        )}
      </div>
    </div>
  );
};
