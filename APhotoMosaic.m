pic = imread("wrinklesCrop.jpg");

fileName = dir.name;
picList = dir(fileName);

# Get rid of . and .. and 'APhotoMosaic.m' and 'AverageColor.m'
picList(1) = [];     
picList(1) = [];
picList(1) = [];     
picList(1) = [];
picList(1).name

numPics = size(picList)(1) - 5;           # Number of pics in the fileset
scaleFactor = floor(sqrt(numPics))   # Number of pics can fit in a row
numSpots = scaleFactor^2            # Total number of pics that can be used

scaleFactor = 7;
numSpots = 7^2;
#numPics = 30

picsRGB = zeros(numPics,3);
spotsRGB = zeros(numSpots,3);

picsEq = zeros(floor(size(pic)(1)/scaleFactor), floor(size(pic)(2)/scaleFactor), 3, numPics);

spotDist = zeros(numSpots,numPics);
loops1 = 0;
for i = 1:numPics
  currentImg = imread(picList(i).name);
  
  picsEq(:, :, :, i) = imresize(currentImg, [floor(size(pic)(1)/scaleFactor) floor(size(pic)(2)/scaleFactor)]);
  loops1+=1
end
# This is the original 
##loops = 0;
##for i = 1:numPics
##  picList(i).name
##  currentImg = imread(picList(i).name);
##  picsRGB(i,:) = AverageColor(currentImg);
##  loops +=1
##end
loops2 = 0;
for i = 1:numSpots
  spotX = i/scaleFactor - 1/scaleFactor;
  if (spotX == floor(spotX))
    spotX = 0
  elseif (spotX > 1)
    spotX = spotX - floor((i-1)/scaleFactor)
  end
  spotY = floor(i/scaleFactor)
  if (spotY == scaleFactor)
    spotY = scaleFactor - 1;
  end
  if (spotX < 0.00001)
    spotX = 0
  end
  currentImg = pic(floor(spotX*size(pic)(1))+1:floor((spotX+1/scaleFactor)*size(pic)(1)), floor(spotY/scaleFactor*size(pic)(2))+1:floor((spotY+1)/scaleFactor*size(pic)(2)), 1:3);
  # imshow(currentImg)
  # spotsRGB(i,:) = AverageColor(currentImg);
  # spotDist(i,:) = vecnorm((picsRGB - spotsRGB(i,:))');
  while (size(currentImg)(1) > size(picsEq)(1))
    disp("adjusted currentImg down");
    currentImg(1,:,:) = [];
  end
  while (size(currentImg)(1) < size(picsEq)(1))
    disp("adjusted picsEq down");
    picsEq(1,:,:,:) = [];
  end
  
  while (size(currentImg)(2) > size(picsEq)(2))
    disp("adjusted currentImg down");
    currentImg(:,1,:) = [];
  end
  while (size(currentImg)(2) < size(picsEq)(2))
    disp("adjusted picsEq down");
    picsEq(:,1,:,:) = [];
  end
  
  
##  imshow(currentImg);
##  w = waitforbuttonpress;
##  imshow(picsEq(:,:,:,1));
##  w = waitforbuttonpress;
##  imshow(picsEq(:,:,:,1) - currentImg);
##  w = waitforbuttonpress;
  for j = 1:numPics
    #size(currentImg)
    #size(picsEq)(1:3)
    A = picsEq(:,:,:,j);
    A = uint8(reshape(A, size(currentImg)));
    #size(A)
    #class(A)
    #class(currentImg)
    spotDist(i,j) = sum(sum(sum(imabsdiff(A, currentImg))));
  end
  #spotDist(i,:) = reshape(sum(sum(sum(imabsdiff(picsEq/255, currentImg)))), [1,numPics]);
  loops2 += 1
end
spotDist

spotMatch = zeros(numSpots,2);

for i = 1:numSpots
  [closest, index] = min(spotDist, [], 2);
  bestMatches = [closest, index];
  [bestMatch, indexBest] = min(bestMatches(:,1));
  bestPic = bestMatches(indexBest,2);
  spotMatch(indexBest,:) = [indexBest, bestPic];
  spotDist(indexBest,:) = 10000000000000;
  spotDist(:, bestPic) = 100000000000000;
  
  spotX = i/scaleFactor - 1/scaleFactor;
  if (spotX == floor(spotX))
    spotX = 0
  elseif (spotX > 1)
    spotX = spotX - floor((i-1)/scaleFactor)
  end
  spotY = floor(i/scaleFactor)
  if (spotY == scaleFactor)
    spotY = scaleFactor - 1;
  end
  if (spotX < 0.00001)
    spotX = 0
  end
  currentImg = pic(floor(spotX*size(pic)(1))+1:floor((spotX+1/scaleFactor)*size(pic)(1)), floor(spotY/scaleFactor*size(pic)(2))+1:floor((spotY+1)/scaleFactor*size(pic)(2)), 1:3);
  # imshow(currentImg)
  # spotsRGB(i,:) = AverageColor(currentImg);
  # spotDist(i,:) = vecnorm((picsRGB - spotsRGB(i,:))');
  while (size(currentImg)(1) > size(picsEq)(1))
    disp("adjusted cure down");
    currentImg(1,:,:) = [];
  end
  while (size(currentImg)(1) < size(picsEq)(1))
    disp("adjusted cure down");
    picsEq(1,:,:,:) = [];
  end
end
spotMatch
mosaic = zeros(scaleFactor*96, scaleFactor*128,3);
#mosaic = [];
loops = 0
for j = 0:scaleFactor-1
  for i = 0:scaleFactor-1
    loops +=1
    nowImg = imread(picList(spotMatch(j*scaleFactor + i+1,2)).name);
    # For clean image scaling
    while (size(nowImg)(1) > 118)
      nowImg = imresize(nowImg, 0.9);
    end
    mosaic(i*96+1:(i+1)*96, j*128+1:(j+1)*128, :) = imresize(nowImg, [96 128]);
    # mosaic(i*96+1:(i+1)*96, j*128+1:(j+1)*128, :) = imresize(imread(picList(spotMatch(j*scaleFactor + i+1,2)).name), [96 128]);
    #mosaic = [mosaic imresize(imread(picList(spotMatch(i,2)).name), [96 128])];
  end
end


#picsRGB
#spotsRGB

imwrite(mosaic/255, 'mosaic.png');
