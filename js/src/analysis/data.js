import debounce from "lodash/debounce";
import { string } from "yoastseo";

import {
	updateReplacementVariable,
	updateData,
} from "../redux/actions/snippetEditor";
import {
	excerptFromContent,
	fillReplacementVariables,
	mapCustomFields,
	mapCustomTaxonomies,
} from "../helpers/replacementVariableHelpers";
import {
	reapplyAnnotationsForSelectedBlock,
} from "../decorator/gutenberg";

/**
 * Represents the data.
 */
class Data {
	/**
	 * Sets the wp data, Yoast SEO refresh function and data object.
	 *
	 * @param {Object} wpData    The Gutenberg data API.
	 * @param {Function} refresh The YoastSEO refresh function.
	 * @param {Object} store     The YoastSEO Redux store.
	 * @returns {void}
	 */
	constructor( wpData, refresh, store ) {
		this._wpData = wpData;
		this._refresh = refresh;
		this._store = store;
		this._data = {};
		this.getPostAttribute = this.getPostAttribute.bind( this );
		this.refreshYoastSEO = this.refreshYoastSEO.bind( this );
	}

	/**
	 * Initializes this Gutenberg data instance.
	 *
	 * @param {Object} replaceVars The replacevars.
	 * @returns {void}
	 */
	initialize( replaceVars ) {
		// Fill data object on page load.
		this._data = this.getInitialData( replaceVars );
		fillReplacementVariables( this._data, this._store );
		this.subscribeToGutenberg();
		this.subscribeToYoastSEO();
	}

	/**
	 * Retrieves the initial data.
	 *
	 * @param {Object} replaceVars The replacevars.
	 *
	 * @returns {Object} The initial data.
	 */
	getInitialData( replaceVars ) {
		const gutenbergData = this.collectGutenbergData( this.getPostAttribute );

		// Custom_fields and custom_taxonomies are objects instead of strings, which causes console errors.
		replaceVars = mapCustomFields( replaceVars, this._store );
		replaceVars = mapCustomTaxonomies( replaceVars, this._store );

		return {
			...replaceVars,
			...gutenbergData,
		};
	}

	/**
	 * Sets the refresh function.
	 *
	 * @param {Function} refresh The refresh function.
	 *
	 * @returns {void}
	 */
	setRefresh( refresh ) {
		this._refresh = refresh;
	}

	/**
	 * Checks whether the current data and the Gutenberg data are the same.
	 *
	 * @param {Object} currentData The current data.
	 * @param {Object} gutenbergData The data from Gutenberg.
	 *
	 * @returns {boolean} Whether the current data and the gutenbergData is the same.
	 */
	isShallowEqual( currentData, gutenbergData ) {
		if ( Object.keys( currentData ).length !== Object.keys( gutenbergData ).length ) {
			return false;
		}

		for ( const dataPoint in currentData ) {
			if ( currentData.hasOwnProperty( dataPoint ) ) {
				if ( ! ( dataPoint in gutenbergData ) || currentData[ dataPoint ] !== gutenbergData[ dataPoint ] ) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Gets the media data by id.
	 *
	 * @param {number} mediaId The media item id.
	 *
	 * @returns {Object} The media object.
	 */
	getMediaById( mediaId ) {
		if ( ! this._coreDataSelect ) {
			this._coreDataSelect = this._wpData.select( "core" );
		}

		return this._coreDataSelect.getMedia( mediaId );
	}

	/**
	 * Retrieves the Gutenberg data for the passed post attribute.
	 *
	 * @param {string} attribute The post attribute you'd like to retrieve.
	 *
	 * @returns {string|number} The post attribute.
	 */
	getPostAttribute( attribute ) {
		if ( ! this._coreEditorSelect ) {
			this._coreEditorSelect = this._wpData.select( "core/editor" );
		}

		return this._coreEditorSelect.getEditedPostAttribute( attribute );
	}

	/**
	 * Get the post's slug.
	 *
	 * @returns {string} The post's slug.
	 */
	getSlug() {
		/**
		 * Before the post has been saved for the first time, the generated_slug is "auto-draft".
		 *
		 * Before the post is saved the post status is "auto-draft", so when this is the case the slug
		 * should be empty.
		 */
		if ( this.getPostAttribute( "status" ) === "auto-draft" ) {
			return "";
		}

		let generatedSlug = this.getPostAttribute( "generated_slug" );

		/**
		 * This should be removed when the following issue is resolved:
		 *
		 * https://github.com/WordPress/gutenberg/issues/8770
		 */
		if ( generatedSlug === "auto-draft" ) {
			generatedSlug = "";
		}

		// When no custom slug is provided we should use the generated_slug attribute.
		return this.getPostAttribute( "slug" ) || generatedSlug;
	}

	/**
	 * Collects the content, title, slug and excerpt of a post from Gutenberg.
	 *
	 * @returns {{content: string, title: string, slug: string, excerpt: string}} The content, title, slug and excerpt.
	 */
	collectGutenbergData() {
		return {
			content: this.getPostAttribute( "content" ),
			title: this.getPostAttribute( "title" ),
			slug: this.getSlug(),
			excerpt: this.getExcerpt(),
			// eslint-disable-next-line camelcase
			excerpt_only: this.getExcerpt( false ),
			snippetPreviewImageURL: this.getFeaturedImage() || this.getContentImage(),
		};
	}

	/**
	 * Gets the source URL for the featured image.
	 *
	 * @returns {null|string} The source URL.
	 */
	getFeaturedImage() {
		const featuredImage = this.getPostAttribute( "featured_media" );
		if ( featuredImage ) {
			const mediaObj = this.getMediaById( featuredImage );

			if ( mediaObj ) {
				return mediaObj.source_url;
			}
		}

		return null;
	}

	/**
	 * Returns the image from the content.
	 *
	 * @returns {string} The first image found in the content.
	 */
	getContentImage() {
		const content = this._coreEditorSelect.getEditedPostContent();

		const images = string.imageInText( content );
		let image = "";

		if ( images.length === 0 ) {
			return null;
		}

		do {
			var currentImage = images.shift();
			currentImage = $( currentImage );

			var imageSource = currentImage.prop( "src" );

			if ( imageSource ) {
				image = imageSource;
			}
		} while ( "" === image && images.length > 0 );

		return image;
	}

	/**
	 * Updates the redux store with the changed data.
	 *
	 * @param {Object} newData The changed data.
	 *
	 * @returns {void}
	 */
	handleEditorChange( newData ) {
		// Handle title change
		if ( this._data.title !== newData.title ) {
			this._store.dispatch( updateReplacementVariable( "title", newData.title ) );
		}
		// Handle excerpt change
		if ( this._data.excerpt !== newData.excerpt ) {
			this._store.dispatch( updateReplacementVariable( "excerpt", newData.excerpt ) );
			this._store.dispatch( updateReplacementVariable( "excerpt_only", newData.excerpt_only ) );
		}
		// Handle slug change
		if ( this._data.slug !== newData.slug ) {
			this._store.dispatch( updateData( { slug: newData.slug } ) );
		}
		// Handle snippet preview image change.
		if ( this._data.snippetPreviewImageURL !== newData.snippetPreviewImageURL ) {
			this._store.dispatch( updateData( { snippetPreviewImageURL: newData.snippetPreviewImageURL } ) );
		}
	}

	/**
	 * Gets the excerpt from the post.
	 *
	 * @param {boolean} useFallBack Whether the fallback for content should be used.
	 *
	 * @returns {string} The excerpt.
	 */
	getExcerpt( useFallBack = true ) {
		const excerpt = this.getPostAttribute( "excerpt" );
		if ( excerpt !== "" || useFallBack === false ) {
			return excerpt;
		}

		return excerptFromContent( this.getPostAttribute( "content" ) );
	}

	/**
	 * If a marker is active, find the associated assessment result and applies the marker on that result.
	 *
	 * @returns {void}
	 */
	reapplyMarkers() {
		const {
			getActiveMarker,
			getMarkerPauseStatus,
		} = this._wpData.select( "yoast-seo/editor" );

		const activeMarker = getActiveMarker();
		const isMarkerPaused = getMarkerPauseStatus();

		if ( ! activeMarker || isMarkerPaused ) {
			return;
		}

		reapplyAnnotationsForSelectedBlock();
	}

	/**
	 * Refreshes YoastSEO's app when the Gutenberg data is dirty.
	 *
	 * @returns {void}
	 */
	refreshYoastSEO() {
		const gutenbergData = this.collectGutenbergData();

		// Set isDirty to true if the current data and Gutenberg data are unequal.
		const isDirty = ! this.isShallowEqual( this._data, gutenbergData );

		if ( isDirty ) {
			this.handleEditorChange( gutenbergData );
			this._data = gutenbergData;
			this._refresh();
		}
	}

	/**
	 * Checks whether new analysis results are available in the store.
	 *
	 * @returns {boolean} Whether new analysis results are available.
	 */
	areNewAnalysisResultsAvailable() {
		const yoastSeoEditorSelectors = this._wpData.select( "yoast-seo/editor" );
		const readabilityResults = yoastSeoEditorSelectors.getReadabilityResults();
		const seoResults         = yoastSeoEditorSelectors.getResultsForFocusKeyword();

		if (
			this._previousReadabilityResults !== readabilityResults ||
			this._previousSeoResults !== seoResults
		) {
			this._previousReadabilityResults = readabilityResults;
			this._previousSeoResults = seoResults;
			return true;
		}

		return false;
	}

	/**
	 * Reapplies the markers when new analysis results are available.
	 *
	 * @returns {void}
	 */
	onNewAnalysisResultsAvailable() {
		this.reapplyMarkers();
	}

	/**
	 * Listens to the Gutenberg data.
	 *
	 * @returns {void}
	 */
	subscribeToGutenberg() {
		this.subscriber = debounce( this.refreshYoastSEO, 500 );
		this._wpData.subscribe(
			this.subscriber
		);
	}

	/**
	 * Listens to the analysis data.
	 *
	 * If the analysisData has changed this.onNewAnalysisResultsAvailable() is called.
	 *
	 * @returns {void}
	 */
	subscribeToYoastSEO() {
		this.yoastSubscriber = () => {
			if ( this.areNewAnalysisResultsAvailable() ) {
				this.onNewAnalysisResultsAvailable();
			}
		};
		this._wpData.subscribe( this.yoastSubscriber );
	}

	/**
	 * Returns the data and whether the data is dirty.
	 *
	 * @returns {Object} The data and whether the data is dirty.
	 */
	getData() {
		return this._data;
	}
}
module.exports = Data;
