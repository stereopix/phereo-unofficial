let thumbs = null;
let viewer = null;
let index_min = 0;
let index_max = 0;
let comments_opened = false;
let current = 0;
let category = "latestuploads";
let xhr = null;

if (window.location.protocol == "http:") window.location = "https://" + window.location.href.substr(7);

function on_phereo_json_received () {
  xhr = null;
  document.getElementById("spinner").style.display = "none";
  if (index_max == index_min) thumbs.innerText = '';
  if (category.startsWith("username:")) return on_phereo_json_userlist_received.call(this);
  if (thumbs && this.status == 200) {
    json = JSON.parse(this.responseText);
    media = []
    json.assets.forEach(asset => {
      const img = document.createElement("img");
      img.src = "/thumb/" + asset.id + ".jpg";
      img.title = asset.title;
      img["data-position"] = index_max;
      img["data-info"] = JSON.stringify(asset); 
      index_max += 1;
      img.addEventListener("click", e => {
        if (viewer) {
          viewer.postMessage({'stereopix_action': 'goto', 'position': e.target['data-position'] - index_min}, 'https://stereopix.net');
          viewer.focus();
        }
        document.getElementById("stereopix_viewer").scrollIntoView();
      });
      media.push({"url": document.location.origin + "/img/" + asset.id + ".jpg" });
      thumbs.appendChild(img);
    });
    if (viewer)
      viewer.postMessage({'stereopix_action': 'list_add_json', 'media': {'media': media}}, 'https://stereopix.net');
    if (json.totalCount > index_max) {
      const imgnext = document.createElement("img");
      imgnext.src = "/next.webp";
      imgnext.title = "Load next images";
      imgnext.addEventListener("click", e => {
        e.target.remove();
        load_page(category, index_max, true);
      });
      thumbs.appendChild(imgnext);
    }
    if (json.totalCount > 25) {
      const max = Math.ceil(json.totalCount/25);
      document.getElementById("page_input").value = 1;
      document.getElementById("page_input").max = max;
      document.getElementById("pages_nb").innerText = max;
      document.getElementById("pages_block").style.display = "inline-block";
    }
  }
}

function on_phereo_json_userlist_received() {
  if (thumbs && this.status == 200) {
    json = JSON.parse(this.responseText);
    json.assets.forEach(asset => {
      const img = document.createElement("img");
      img.src = "/avatar/" + asset.id + ".jpg";
      img.title = asset.username;
      img["data-id"] = asset.id;
      index_max += 1;
      img.addEventListener("click", e => {
        load_page("user:" + e.target["data-id"]);
      });
      thumbs.appendChild(img);
    });
    if (json.totalCount > index_max) {
      const imgnext = document.createElement("img");
      imgnext.src = "/next.webp";
      imgnext.title = "Load next users";
      imgnext.addEventListener("click", e => {
        e.target.remove();
        load_page(category, index_max, true);
      });
      thumbs.appendChild(imgnext);
    }
    if (json.totalCount > 25) {
      const max = Math.ceil(json.totalCount/25);
      document.getElementById("page_input").value = 1;
      document.getElementById("page_input").max = max;
      document.getElementById("pages_nb").innerText = max;
      document.getElementById("pages_block").style.display = "inline-block";
    }
  }
}

function load_page(cat, start, keep) {
  if (xhr) xhr.abort();
  if (!start) start = 0;
  if (!keep) {
    document.getElementById("info_block").style.display = "none";
    document.getElementById("pages_block").style.display = "none";
    category = cat;
    index_max = start;
    index_min = index_max;
    current = 0;
    if (thumbs)
      thumbs.innerText = "";
    if (viewer)
      viewer.postMessage({'stereopix_action': 'list_clear'}, 'https://stereopix.net');
  }
  if (cat.startsWith("username:") && thumbs)
    thumbs.innerText = 'Searching users might be very slow...';
  xhr = new XMLHttpRequest();
  xhr.addEventListener("load", on_phereo_json_received);
  xhr.open("GET", "/api/" + cat + "/" + index_max + ".json");
  xhr.send();
  document.getElementById("spinner").style.display = "block";
}

function format_date(v) {
  d = new Date(v*1000);
  function pad(i) { return ((i < 10) ? "0" : "") + i; }
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes())
}

window.addEventListener('message', function(e) {
	if (e.origin == 'https://stereopix.net') {
		if (e.data.type == 'viewerReady') {
			viewer = e.source;
      viewer.focus();

    } else if (e.data.type == 'mediumChanged') {
      document.getElementById("info_avatar").src = "data:,";
      document.getElementById("comments").innerText = "";
      comments_opened = false;
      if (thumbs) {
        tc = thumbs.children.item(current);
        if (tc) tc.classList.remove("active");
        tn = thumbs.children.item(e.data.position)
        if (tn) {
          tn.classList.add("active");
          json = JSON.parse(tn["data-info"]);
          document.getElementById("info_block").style.display = "inline-grid";
          document.getElementById("info_block")["data-id"] = json.comments > 0 ? json.id : undefined;
          document.getElementById("info_title").innerText = json.title;
          document.getElementById("info_desc").innerText = json.description;
          document.getElementById("info_views").innerText = json.views;
          document.getElementById("info_likes").innerText = json.likes;
          document.getElementById("info_comments").innerText = json.comments;
          document.getElementById("info_date").innerText = format_date(json.created);
          document.getElementById("info_user").innerText = json.user.name;
          document.getElementById("info_avatar").src = "/avatar/" + json.user.id + ".jpg";
          document.getElementById("info_avatar").onclick = e => { load_page("user:" + json.user.id); };
        }
      }
      current = e.data.position;
    }
  }
});

window.addEventListener("DOMContentLoaded", e => {
  thumbs = document.getElementById("thumbs");

  document.getElementById("cat_l").addEventListener("click", e => load_page("latestuploads"));
  document.getElementById("cat_p").addEventListener("click", e => load_page("popular"));
  document.getElementById("cat_f").addEventListener("click", e => load_page("awards"));
  document.getElementById("cat_s").addEventListener("click", e => load_page("staffpicks"));

  document.getElementById("tag_form").addEventListener("submit", e => {
    e.preventDefault();
    load_page("tag:" + encodeURIComponent(document.getElementById("tag_input").value));
    return false;
  });
  document.getElementById("search_form").addEventListener("submit", e => {
    e.preventDefault();
    load_page("search:" + encodeURIComponent(document.getElementById("search_input").value));
    return false;
  });
  document.getElementById("searchuser_form").addEventListener("submit", e => {
    e.preventDefault();
    load_page("username:" + document.getElementById("searchuser_input").value);
    return false;
  });
  document.getElementById("pages_form").addEventListener('submit', e => {
    e.preventDefault();
    load_page(category, 25 * (document.getElementById("page_input").value - 1));
    return false;
  });
  document.getElementById("info_block").addEventListener("click", e => {
    const id = document.getElementById("info_block")["data-id"];
    if (comments_opened || !id) return;
    if (xhr) xhr.abort();
    xhr = new XMLHttpRequest();
    const on_com_loaded = e => {
      document.getElementById("spinner").style.display = "none";
      comjson = JSON.parse(xhr.responseText);
      xhr = null;
      comjson.data.forEach(com => {
        const extdiv = document.createElement("div");
        extdiv.classList.add("comment");
        const comimg = document.createElement("img");
        comimg.src = "/avatar/" + com.user.id + ".jpg";
        comimg.onclick = e => { load_page("user:" + com.user.id); };
        const intdiv = document.createElement("div");
        intdiv.classList.add("col2");
        extdiv.appendChild(comimg);
        extdiv.appendChild(intdiv);
        const p1 = document.createElement("p");
        p1.innerText = " " + format_date(com.created);
        const b = document.createElement("b");
        b.innerText = com.user.name;
        p1.insertBefore(b, p1.firstChild);
        const p2 = document.createElement("p");
        p2.innerText = com.body;
        intdiv.appendChild(p1);
        intdiv.appendChild(p2);
        document.getElementById("comments").appendChild(extdiv);
      });
    };
    xhr.addEventListener("load", on_com_loaded);
    xhr.open("GET", "/comments/" + id + ".json");
    xhr.send();
    document.getElementById("spinner").style.display = "block";
    comments_opened = true;
  });
});
