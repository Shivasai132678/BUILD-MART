import os
import urllib.request

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".stitch", "designs")
os.makedirs(out_dir, exist_ok=True)

files = [
    {
        "name": "homepage",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzcwMDgxNWNlODllOTQ2MmRhYWZjNmM4ODU2ZDYyZmE5EgsSBxD3ufTr0BQYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDQzMDEyODgxNzMwMTQ5OTA4Nw&filename=&opi=96797242",
        "img": "https://lh3.googleusercontent.com/aida/AOfcidXihgwLlc2gO3VS7lj__9V-pknoopsNvtIamu_lzOPWk9Ex-mFCa4Yew19NoWwVfs86Fi9zmOesmAvFcvv1eoL_W6I951-cTFGzSP1_POClKxvVFC491aqQHWT7vGjvV5YMVP3AcLBLcdSOjF_lKWvqMJPqPvS0AgrlcosMIk-4u-ZtwmsQY7Do4KeCXelbC1IwQvdxAKwpN--_36ssjI2TAjKrKImyXr4ujEEZdyCj-FvZh6BhdS1wG49y=w2560"
    },
    {
        "name": "login",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2Q4ZGE5YmZkYmY2NTRiNGI5ZmZjNjM0ZDI2MjQwOTlmEgsSBxD3ufTr0BQYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDQzMDEyODgxNzMwMTQ5OTA4Nw&filename=&opi=96797242",
        "img": "https://lh3.googleusercontent.com/aida/AOfcidV0oTHPTxFASBHbMiA-4MfnsM_bA94E0DGinMpm27hZgkR81JFHMxa73B1MaglqceVX7voSb0dNEgGnMtzm91u3MXOHBVtrWKHA8o-x5crfVoRw7srD1CFr9K4uhW_Dc4wISeesh3AggVfjWhxW0IaGGyJH6yuWGY4nYOGuhBl1QvnAafhZ7_u3_7j2Gq2d1hYdMXjav2XSGEkF0tWvtZhAPynH-lgNLjVJh3ZIKKjfc7-NgMsyeP3uetHE=w2560"
    },
    {
        "name": "buyer-dashboard",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzJjZjNlMGFiMDhhMTQ2OTNiYzE4NjIxZDA2YjMzZmIyEgsSBxD3ufTr0BQYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDQzMDEyODgxNzMwMTQ5OTA4Nw&filename=&opi=96797242",
        "img": "https://lh3.googleusercontent.com/aida/AOfcidXqDwutVbJSE_8TprGlnceQ3k0pmkNOP8gFbVeBJmj0sy1fN3SU1hkIcLS4oko3qhqJSwD4N8UkLrrprOtJm0Mu-V_qy4UXHX7Zljl5yAoMF35nbvPoNvCWE28fNxqhttdXmCii2DcuO38PVuNDjoZ73OUPXK7R3SjgIcTCkq-HEsiXVIq7tUXYvclLSj4i3KYnSVPjhn7zZaWuJtp0GMnxu9j96eq7581dlLGoSs2Bv9iSujWehqvndNjm=w2560"
    },
    {
        "name": "vendor-dashboard",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2FkOTI1YjBhYmEwMjRjOWY5N2EzNWY3YzEzZTdiY2JlEgsSBxD3ufTr0BQYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDQzMDEyODgxNzMwMTQ5OTA4Nw&filename=&opi=96797242",
        "img": "https://lh3.googleusercontent.com/aida/AOfcidUx39_qCyo7CX1wazvdM4n3idJq1qToGIw2Kc-bq_UCUtnwbaM984tKL6qwcTTPL9jXbn9rPQhGf7BAhGfO2QgoGrBpdoBQ2XxcdDP9vcVvQcL_--aeQn4exbUQTKpj9RCWGJnonR0w9z7gZw0AWdU8SUvKqF4RN_O_WAYudR4-ZNup3adGzEpRZh2zUVSlo-pv1QFpuH1nTWxZ3KfulLabUTzx49Hw2UOJMOYVyggwzgcir2dnInl9O4E=w2560"
    },
    {
        "name": "buyer-catalog",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzZmMzdkMjM4YzEwNTQwYjQ4YWVkYmZjODJmOGEzZWY0EgsSBxD3ufTr0BQYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDQzMDEyODgxNzMwMTQ5OTA4Nw&filename=&opi=96797242",
        "img": "https://lh3.googleusercontent.com/aida/AOfcidU33zu2ANIcXdwqf05DTo3GafGAu0peAnQRkGvHKNVH9i2Y50dKSEmylIf-w6WKDGCiCVojvczssBTlvUpYt03raskSzGwBcoDOeLAb9G932vDD2oPjfFiGwdxUR70-cCDgbRgeDP53z-bb1bWA658-aGVs1bo5JT6olvvxfTZdMHMeiINtNUclIcyzgflrVrVKbt98iLhXPUXUemR2kKW32MEZu7kKWAuFga1DoFhU044VyL4T78IcZrdz=w2560"
    },
    {
        "name": "vendor-rfq",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzhhMDUzMDAwZDE2YzQzZTA5MWJmMWFkMzU2YmQ4OTEyEgsSBxD3ufTr0BQYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDQzMDEyODgxNzMwMTQ5OTA4Nw&filename=&opi=96797242",
        "img": "https://lh3.googleusercontent.com/aida/AOfcidXmCv56XEpkjZU3JJ3QXnKJdhjBOuB6Ci-rwbl2eCUg9Et6RUy5UAejMnXTDO9lYxTMHS--Jx-4kq-9QGJZSzMJ10zdrtctE4D4ZOUZIdIOVOfgq-nWtwFp9SeBntiANJr1R6e-wByOqkC9-AfG-p1ZtED1Lk9khKTVSH3W9OMrSh6Ucqcw0XqAqMOBdqy8L7lWR2ZoXmnvzdqX2vo0Q0NrvdvDj-z3W6cimEIqf4VUBBVZV1xeJEEvthP1=w2560"
    },
    {
        "name": "admin-dashboard",
        "html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzMwMDBlZTFlMzYyOTQyZjI5YTQ3NjdmMWNmNjlmNzE1EgsSBxD3ufTr0BQYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDQzMDEyODgxNzMwMTQ5OTA4Nw&filename=&opi=96797242",
        "img": "https://lh3.googleusercontent.com/aida/AOfcidUTG5Ae5V39hvnWsnhIsfe2DX-WZ9xtAZgjBdpnfQPeH6dZ-R6mhWMuaPmeMLIbqGAmi-PP_OsmmoA_7QdnYudOP4fk77ysZ9U3GAOVTBLbsTQKVrhGjX0KifOMmYbJHqVJf9P5Chks-74Oct4jB1IxO6_moV6EkXlIBnsLaKPquUwReJagukBw3mNf32IO6hnGl_Zwx5SQlX23OOasVKyTg1Qnx7gQDxE4zyvuEze3zFtXG7Ka4UJU02I=w2560"
    }
]

for f in files:
    print(f"Downloading {f['name']}...")
    try:
        urllib.request.urlretrieve(f["html"], os.path.join(out_dir, f"{f['name']}.html"))
        urllib.request.urlretrieve(f["img"], os.path.join(out_dir, f"{f['name']}.png"))
    except Exception as e:
        print(f"Failed to download {f['name']}: {e}")

print("Done.")
