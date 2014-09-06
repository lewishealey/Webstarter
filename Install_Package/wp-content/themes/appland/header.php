<!doctype html>
<html <?php language_attributes(); ?> class="no-js">
	<head>
		<meta charset="<?php bloginfo('charset'); ?>">
		<title><?php wp_title(''); ?><?php if(wp_title('', false)) { echo ' :'; } ?> <?php bloginfo('name'); ?></title>
		
		<!-- dns prefetch -->
		<link href="//www.google-analytics.com" rel="dns-prefetch">
		
		<!-- meta -->
		<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
		<meta name="viewport" content="width=device-width,initial-scale=1.0">
		
		<!-- Webfont load -->
		<link href='http://fonts.googleapis.com/css?family=Open+Sans:300italic,400,300,600,700' rel='stylesheet' type='text/css'>
		
		
		<!-- icons -->
		<link href="<?php echo get_template_directory_uri(); ?>/img/icons/favicon.ico" rel="shortcut icon">
		<link href="<?php echo get_template_directory_uri(); ?>/img/icons/touch.png" rel="apple-touch-icon-precomposed">
		<!-- <link rel="stylesheet/less" type="text/css" href="<?php echo get_template_directory_uri(); ?>/less/style.less" /> 
		LESS support if you want - Make sure you clean style.css out -->
			
		<!-- css + javascript -->
		<?php wp_head(); ?>
		
		<script>
		!function(){
			// configure legacy, retina, touch requirements @ conditionizr.com
			conditionizr()
		}()
		</script>
		
		<!-- Support for IE9 -->
		<!--[if lt IE 9]>
			<script src="http://html5shim.googlecode.com/svn/trunk/html5.js"></script>
			<link rel="stylesheet" href="<?php bloginfo( 'template_url' );?>/css/ie.css">
		<![endif]-->

	</head>
	<body>
	
	<!-- Header -->
<header class="header clear" role="banner">

<div class="container">
<div class="row">
<div class="col-md-8">
      <ul class="nav nav-pills">
      <li class="logo">APPLAND</li>
  <li><a href="#feature">Features</a></li>
  <li><a href="#hero">Closer Look</a></li>
  <li><a href="#capture">Action</a></li>
  <li class="active"><a href="#savior">Call to action</a></li>
</ul>
</div>

<div class="col-md-4 align-right">
<img src="http://localhost:8888/Template/Local%20Root/wp-content/uploads/2014/03/Download_on_the_App_Store_Badge_US-UK_135x40.png">
</div>
</div>
</div>


</header>