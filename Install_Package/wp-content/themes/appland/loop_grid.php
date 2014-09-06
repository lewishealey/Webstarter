<?php if (have_posts()): while (have_posts()) : the_post(); ?>
	
	<div class="col-xs-6 col-sm-6 col-md-6">
	<!-- article -->
	<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
	
		<!-- post thumbnail -->
		<?php if ( has_post_thumbnail()) : // Check if thumbnail exists ?>
			<a href="<?php the_permalink(); ?>" title="<?php the_title(); ?>">
				<?php the_post_thumbnail(array(120,120)); // Declare pixel size you need inside the array ?>
			</a>
		<?php endif; ?>
		<!-- /post thumbnail -->
	
				
		<!-- post details -->
		<span class="date"><?php the_time('F j, Y'); ?> <?php the_time('g:i a'); ?></span>
				<!-- /post details -->
		
		<!-- post title -->
		<h2>
			<a href="<?php the_permalink(); ?>" title="<?php the_title(); ?>"><?php the_title(); ?></a>
		</h2>
		<!-- /post title -->
		
		<img data-src="holder.js/500x350/auto/#ccc:#fff/text:News" alt="News">
		
		<p><?php html5wp_excerpt('html5wp_index'); // Build your custom callback length in functions.php ?></p>
		<p><a href="#">Read more <i class="fa fa-angle-right"></i></a>
		
	</article>
	<!-- /article -->
	</div>
	
<?php endwhile; ?>

<?php else: ?>

	<!-- article -->
	<article>
		<h2><?php _e( 'Sorry, nothing to display.', 'wpblank' ); ?></h2>
	</article>
	<!-- /article -->

<?php endif; ?>