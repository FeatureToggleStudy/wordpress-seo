<?php
/**
* WPSEO plugin test file.
*/

namespace Yoast\WP\Free\Tests\Integrations\Front_End;

use Mockery;
use Yoast\WP\Free\Helpers\Current_Page_Helper;
use Yoast\WP\Free\Helpers\Options_Helper;
use Yoast\WP\Free\Integrations\Front_End\Webmaster_Tools_Meta;
use Yoast\WP\Free\Tests\TestCase;

/**
* Unit Test Class.
*
* @coversDefaultClass \Yoast\WP\Free\Integrations\Front_End\Webmaster_Tools_Meta
* @covers ::<!public>
 *
 * @group integrations
 * @group front-end
*/
class Webmaster_Tools_Meta_Test extends TestCase {

	/**
	 * The test instance.
	 *
	 * @var Webmaster_Tools_Meta
	 */
	private $instance;

	/**
	 * The current page helper mock.
	 *
	 * @var Mockery\MockInterface|Current_Page_Helper
	 */
	private $current_page;

	/**
	 * The options helper mock.
	 *
	 * @var Mockery\MockInterface|Options_Helper
	 */
	private $options;


	/**
	 * Sets an instance for test purposes.
	 */
	public function setUp() {
		parent::setUp();

		$this->options      = Mockery::mock( Options_Helper::class );
		$this->current_page = Mockery::mock( Current_Page_Helper::class );
		$this->instance     = new Webmaster_Tools_Meta( $this->options, $this->current_page );
	}

	/**
	 * Test rendering of the meta tags for a non frontpage.
	 *
	 * @covers ::render_meta_tags
	 */
	public function test_render_meta_tags_for_a_non_front_page() {
		$this->current_page->expects( 'is_front_page' )
			->once()
			->andReturnFalse();

		$this->instance->render_meta_tags();

		$this->expectOutput( '' );
	}

	/**
	 * Tests rendering of the meta tags for a frontpage, but no meta tags are set.
	 *
	 * @covers ::render_meta_tags
	 * @covers::set_tag_value
	 * @covers::has_tag_value
	 */
	public function test_render_meta_tags_for_a_front_page_and_no_tags_set() {
		$this->current_page->expects( 'is_front_page' )
			->once()
			->andReturnTrue();

		$this->options->expects( 'get' )->once()->with( 'baiduverify', '' )->andReturn( '' );
		$this->options->expects( 'get' )->once()->with( 'msverify', '' )->andReturn( '' );
		$this->options->expects( 'get' )->once()->with( 'googleverify', '' )->andReturn( '' );
		$this->options->expects( 'get' )->once()->with( 'pinterestverify', '' )->andReturn( '' );
		$this->options->expects( 'get' )->once()->with( 'yandexverify', '' )->andReturn( '' );

		$this->instance->render_meta_tags();

		$this->expectOutput( '' );
	}

	/**
	 * Tests rendering of the meta tags for a frontpage and having a tag value set.
	 *
	 * @covers ::render_meta_tags
	 * @covers ::set_tag_value
	 * @covers ::has_tag_value
	 * @covers ::render_meta_tag
	 */
	public function test_render_meta_tags_for_a_front_page_and_have_a_set_tag_value() {
		$this->current_page->expects( 'is_front_page' )
			->once()
			->andReturnTrue();

		$this->options->expects( 'get' )->once()->with( 'baiduverify', '' )->andReturn( '' );
		$this->options->expects( 'get' )->once()->with( 'msverify', '' )->andReturn( '' );
		$this->options->expects( 'get' )->once()->with( 'googleverify', '' )->andReturn( '' );
		$this->options->expects( 'get' )->once()->with( 'pinterestverify', '' )->andReturn( 'qwerty' );
		$this->options->expects( 'get' )->once()->with( 'yandexverify', '' )->andReturn( '' );

		$this->instance->render_meta_tags();

		$this->expectOutputContains( '<meta name="p:domain_verify" content="qwerty" />' );
	}

}
