<?php get_header(); ?>

</div> <!-- /container -->


<div class="full-carousel">

<div class="container">
<?php echo do_shortcode('[image-carousel]') ?>        
</div>

</div> <!-- / CAROUSEL -->

<div id="content">
<div class="container">
<div class="row">

<!-- MAIN CONTENT -->
<div class="col-md-8">

<div class="row">

<div class="col-xs-6 col-sm-6 col-md-6">
<img data-src="holder.js/500x350/auto/#ccc:#fff/text:Featured" alt="Featured">
</div>

<div class="col-xs-6 col-sm-6 col-md-6">
<span class="date">Thursday 18th October 2013</span>
<h2>Lorem ipsum dolor sit amet</h2>
<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>

<p>Continue ></p>
</div>

</div>

<div class="row">
<div class="col-md-12 news">
<nav class="navbar navbar-default" role="navigation">

	<ul class="nav navbar-nav navbar-left">
       <li><a href="#"><i class="fa fa-angle-right"></i> News</a></li>
    </ul>
          
        <!-- Collect the nav links, forms, and other content for toggling -->
          <ul class="nav navbar-nav navbar-right">
            <li id="grid-select"><a href="#"><i class="fa fa-th"></i> Grid</a></li>
            <li id="list-select"><a href="#"><i class="fa fa-list"></i> List</a></li>
          </ul>
      </nav>
</div>
</div>

<div class="row">

<div id="grid">
<?php get_template_part('loop_grid'); ?>
<?php get_template_part('pagination'); ?>
</div>
	
<div id="list">	
<?php get_template_part('loop_list'); ?>
<?php get_template_part('pagination'); ?>
</div>

</div>

</div> 

<!-- SIDEBAR -->
<div class="col-md-4 sidebar">
<?php get_sidebar(); ?>
</div> 
<!--  / SIDEBAR -->

</div><!-- / #CONTENT -->



</div>

	

<?php get_footer(); ?>