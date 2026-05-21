package api

import (
	"fastsend/internal/config"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/image/draw"
)

func ThumbnailHandler(c *gin.Context) {
	filePath := c.Param("filepath")
	originalPath := config.UploadDir + filePath

	// 检查原文件是否存在
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		c.Status(404)
		return
	}

	// 非图片文件直接回退到原文件
	ext := strings.ToLower(filepath.Ext(originalPath))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" {
		c.File(originalPath)
		return
	}

	// 缩略图缓存路径
	thumbPath := filepath.Join(config.ThumbDir, filePath)

	// 缓存命中
	if _, err := os.Stat(thumbPath); err == nil {
		c.File(thumbPath)
		return
	}

	// 生成缩略图
	os.MkdirAll(filepath.Dir(thumbPath), 0755)

	src, err := os.Open(originalPath)
	if err != nil {
		c.File(originalPath)
		return
	}
	defer src.Close()

	srcImg, _, err := image.Decode(src)
	if err != nil {
		c.File(originalPath)
		return
	}

	bounds := srcImg.Bounds()
	w := bounds.Dx()
	h := bounds.Dy()

	const maxW = 400
	if w <= maxW {
		c.File(originalPath)
		return
	}

	newW := maxW
	newH := h * maxW / w

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), srcImg, bounds, draw.Over, nil)

	os.MkdirAll(filepath.Dir(thumbPath), 0755)

	dstFile, err := os.Create(thumbPath)
	if err != nil {
		c.File(originalPath)
		return
	}
	defer dstFile.Close()

	jpeg.Encode(dstFile, dst, &jpeg.Options{Quality: 80})

	c.File(thumbPath)
}
