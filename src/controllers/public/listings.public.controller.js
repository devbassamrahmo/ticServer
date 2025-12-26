const {
  searchPublicListingsForSite,
  getPublicListingByIdForSite,
  getSimilarPublicListingsForSite,
} = require('../../models/listing.model');

exports.searchListings = async (req, res) => {
  try {
    const { site_id } = req.params;

    const data = await searchPublicListingsForSite(site_id, req.query, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    return res.json({ success: true, ...data });
  } catch (err) {
    console.error('public searchListings error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.getListing = async (req, res) => {
  try {
    const { site_id, listingId } = req.params;

    const listing = await getPublicListingByIdForSite(site_id, listingId);
    if (!listing) return res.status(404).json({ success: false, message: 'غير موجود' });

    const similar = await getSimilarPublicListingsForSite(site_id, listingId, { limit: 6 });

    return res.json({ success: true, listing, similar });
  } catch (err) {
    console.error('public getListing error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
